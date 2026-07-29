/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */


// Required for side-effects
import { initializeApp } from "firebase/app";
import "firebase/firestore";
import { Device } from '@capacitor/device';
import { DocumentReference, addDoc, collection, getDocs, getFirestore, updateDoc } from "firebase/firestore";
import { Injectable } from "@angular/core";
import {
  Activity,
  TypedActivityResult,
  TypedActivitySessionStart,
  User
} from "../models/firebase.types";
import { query, where } from "@angular/fire/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDSpKBGWsrGNkocpyN_ledyIomcGJ14Pto",
  authDomain: "mei-trumpet.firebaseapp.com",
  projectId: "mei-trumpet",
  storageBucket: "mei-trumpet.appspot.com",
  messagingSenderId: "874766472837",
  appId: "1:874766472837:web:87d898a7b07de47e097bec",
  measurementId: "G-150GS2FPPB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

@Injectable({
  providedIn: 'root'
})
/**
 * Service for managing user activities and interactions with Firebase.
 */
export class FirebaseService {
  currentActivity!: Activity;

  constructor() {
    this.uploadSavedActivities();
  }

  /**
   * Saves the current activity to local storage.
   * @param tempo - The tempo of the activity.
   * @param lowNote - The lowest note of the activity.
   * @param highNote - The highest note of the activity.
   * @param refFrequencyValue - The reference frequency value for the activity.
   * @param useFlatsAndSharps - Whether to use flats and sharps in the activity.
   * @param useDynamics - Whether to use dynamics in the activity.
   * @returns void
   * @example
   * firebaseService.saveStart(120, 60, 80, 440, true, false);
   */
  public async saveStart(
    tempo: number,
    lowNote: number,
    highNote: number,
    refFrequencyValue: number,
    useFlatsAndSharps: boolean,
    useDynamics: boolean
  ) {
    const startTime = new Date();
    const deviceInfo = await Device.getInfo();
    const deviceId = await Device.getId();

    this.currentActivity = {
      tempo,
      lowNote,
      highNote,
      refFrequencyValue,
      useFlatsAndSharps,
      startTime,
      useDynamics,
      device: {
        id: deviceId.identifier,
        model: deviceInfo.model,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion,
      },
    };

    this.saveToLocalStorage(this.currentActivity);
  }

  /**
   * Saves the current activity and uploads it to Firebase.
   * @param action - The action performed on the activity ('finished' or 'interrupted').
   * @param collectedMeansObject - An object containing collected data during the activity.
   * @returns void
   * @example
   * firebaseService.saveStop('finished', { notes: [1, 2, 3] });
   */
  public async saveStop(action: 'finished' | 'interrupted', collectedMeansObject: { [key: string]: number[] }) {
    const endTime = new Date();
    this.currentActivity = {
      ...this.currentActivity,
      action,
      endTime,
      duration: (endTime.getTime() - this.currentActivity.startTime.getTime()) / 1000,
      collectedMeansObject,
    };

    this.updateInLocalStorage(this.currentActivity);

    // save to Firebase
    try {
      await this.saveActivity(this.currentActivity);
      // remove from local storage
      this.removeFromLocalStorage(this.currentActivity);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }

  /**
   * Opens a versioned activity record while retaining the established
   * offline-first local-storage and upload path.
   */
  public async saveTypedActivityStart(
    envelope: TypedActivitySessionStart
  ): Promise<void> {
    const deviceInfo = await Device.getInfo();
    const deviceId = await Device.getId();

    this.currentActivity = {
      // Legacy fields remain populated to keep historical readers total.
      tempo: 0,
      lowNote: Number(envelope.configuration['lowNoteIndex'] ?? 0),
      highNote: Number(envelope.configuration['highNoteIndex'] ?? 0),
      refFrequencyValue: Number(
        envelope.configuration['referenceA4Hz'] ?? 440
      ),
      useFlatsAndSharps: Boolean(
        envelope.configuration['includeAccidentals']
      ),
      useDynamics: false,
      startTime: new Date(),
      device: {
        id: deviceId.identifier,
        model: deviceInfo.model,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion
      },
      schemaVersion: envelope.schemaVersion,
      sessionId: envelope.sessionId,
      activityId: envelope.activityId,
      activityVersion: envelope.activityVersion,
      instrumentId: envelope.instrumentId,
      configuration: envelope.configuration,
      sessionStartedAtMs: envelope.sessionStartedAtMs
    };

    this.saveToLocalStorage(this.currentActivity);
  }

  /**
   * Persists aggregate target-intonation results. No raw audio or frame-level
   * pitch estimates are accepted by the typed result contract.
   */
  public async saveTypedActivityStop(
    result: TypedActivityResult
  ): Promise<void> {
    const endTime = new Date();
    this.currentActivity = {
      ...this.currentActivity,
      action: result.outcome === 'completed' ? 'finished' : 'interrupted',
      endTime,
      duration:
        (endTime.getTime() - this.currentActivity.startTime.getTime()) / 1000,
      activityResult: result
    };

    this.updateInLocalStorage(this.currentActivity);
    try {
      await this.saveActivity(this.currentActivity);
      this.removeFromLocalStorage(this.currentActivity);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }


  public async registerUser(user: User): Promise<DocumentReference> {
    try {
      const userDocRef = await addDoc(collection(db, 'user_info'), user);
      console.log('User  registered with ID:', userDocRef.id);
      return userDocRef;
    } catch (e) {
      console.log('Error', e);
      throw e;
    }
  }

  /**
   * Checks if a user exists in the Firestore database.
   * @param userId - The ID of the user to check.
   * @returns {Promise<boolean>} A promise that resolves to true if the user exists, otherwise false.
   * @example
   * const exists = await firebaseService.checkUser Exists('123');
   */
  public async checkUserExists(userId: string): Promise<boolean> {
    try {
      const q = query(collection(db, 'user_info'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;  // Returns true if user exists
    } catch (e) {
      console.error('Error checking user existence:', e);
      throw e;
    }
  }

  /**
   * Saves an activity to the Firestore database.
   * @param activity - The activity to be saved.
   * @returns {Promise<DocumentReference>} A promise that resolves to the document reference of the saved activity.
   */
  private async saveActivity(activity: Activity): Promise<DocumentReference> {
    const docId = await addDoc(collection(db, "activities"), activity);
    return docId;
  }

  /**
   * Saves the given activity to local storage.
   * @param activity - The activity to be saved.
   * @returns void
   */
  private saveToLocalStorage(activity: Activity) {
    const activities = this.loadActivitiesFromLocalStorage();
    activities.push(activity);
    localStorage.setItem('activities', JSON.stringify(activities));
  }

  /**
   * Uploads saved activities to Firebase.
   * Retrieves activities from local storage and saves them to Firebase.
   * Removes saved activities from local storage after they have been successfully saved to Firebase.
   * @returns void
   */
  private async uploadSavedActivities() {
    let activities = this.loadActivitiesFromLocalStorage();
    for (let activity of activities) {
      try {
        await this.saveActivity(activity);
        // remove from local storage
        this.removeFromLocalStorage(activity);
      } catch (e) {
        console.error("Error adding document: ", e);
      }
    }
  }

  /**
   * Removes the given activity from local storage.
   * @param activity - The activity to be removed.
   * @returns void
   */
  private removeFromLocalStorage(activity: Activity): void {
    let activities = this.loadActivitiesFromLocalStorage();
    activities = activities.filter((a: Activity) => a.startTime.toISOString() !== activity.startTime.toISOString());
    localStorage.setItem('activities', JSON.stringify(activities));
  }

  /**
   * Updates the activity in the local storage.
   * @param activity - The activity to update.
   * @returns void
   */
  private updateInLocalStorage(activity: Activity): void {
    let activities = this.loadActivitiesFromLocalStorage();
    const index = activities.findIndex((a: Activity) => a.startTime.toISOString() === activity.startTime.toISOString());
    activities[index] = activity;
    localStorage.setItem('activities', JSON.stringify(activities));
  }

  /**
   * Loads activities from local storage.
   * @returns {Activity[]} An array of activities loaded from local storage.
   */
  private loadActivitiesFromLocalStorage(): Activity[] {
    const activitiesJSON = JSON.parse(localStorage.getItem('activities') || '[]');
    const activities = activitiesJSON.map((a: any) => {
      const activity = {
        ...a,
        startTime: a.startTime ? new Date(a.startTime) : undefined,
      };
      if (a.endTime) {
        activity['endTime'] = new Date(a.endTime);
      }
      return activity;
    });

    return activities;
  }
}
