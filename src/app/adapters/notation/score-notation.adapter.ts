import { Injectable } from '@angular/core';
import { NotationPort } from '../../core/activity/activity-context';
import { NoteTarget } from '../../instruments/instrument-definition';
import { Score } from '../../models/score.types';
import { scoreFromNote } from '../../utils/score.utils';

@Injectable({
  providedIn: 'root'
})
export class ScoreNotationAdapter implements NotationPort {
  forPrepareListenPlay(target: NoteTarget, dynamic?: string): Score {
    return scoreFromNote(target.displayToken, target.instrumentId, dynamic);
  }
}
