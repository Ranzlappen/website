/**
 * MatchClient — a small, observable controller around a {@link MatchState}.
 *
 * It owns the current state, an action log (for replays / serialization), and
 * undo/redo stacks. The React layer subscribes to it via `useSyncExternalStore`;
 * the multiplayer layer feeds remote actions in through `applyRemote` /
 * `replaceState`. Nothing here is React-specific.
 */
import { applyAction } from './match';
import type {
  ApplyResult,
  GameAction,
  GameDefinition,
  MatchState,
} from './types';

export interface LoggedAction {
  action: GameAction;
  /** The match version produced by this action. */
  version: number;
  at: number;
}

type Listener = () => void;

export interface DispatchOptions {
  /** Don't push onto the undo stack (used when replaying remote actions). */
  ephemeral?: boolean;
}

export class MatchClient<G = unknown> {
  readonly def: GameDefinition<G>;
  private state: MatchState<G>;
  private log: LoggedAction[] = [];
  private undoStack: MatchState<G>[] = [];
  private redoStack: MatchState<G>[] = [];
  private listeners = new Set<Listener>();
  private lastError: string | null = null;

  constructor(def: GameDefinition<G>, initial: MatchState<G>) {
    this.def = def;
    this.state = initial;
  }

  getState = (): MatchState<G> => this.state;
  getLog = (): readonly LoggedAction[] => this.log;
  getError = (): string | null => this.lastError;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** Apply a local action. Returns the result; updates state + history on success. */
  dispatch(action: GameAction, opts: DispatchOptions = {}): ApplyResult<G> {
    const result = applyAction(this.def, this.state, action);
    if (!result.ok) {
      this.lastError = result.error;
      this.emit();
      return result;
    }
    this.lastError = null;
    if (!opts.ephemeral) {
      this.undoStack.push(this.state);
      this.redoStack = [];
    }
    this.state = result.state;
    this.log.push({
      action: result.action,
      version: result.state.version,
      at: result.state.updatedAt,
    });
    this.emit();
    return result;
  }

  /** Clear any surfaced error without changing state. */
  clearError() {
    if (this.lastError !== null) {
      this.lastError = null;
      this.emit();
    }
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.state);
    this.state = prev;
    this.log.pop();
    this.lastError = null;
    this.emit();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.state);
    this.state = next;
    this.lastError = null;
    this.emit();
    return true;
  }

  /**
   * Replace the entire state from an authoritative remote snapshot. Ignored if
   * the incoming version is not newer (guards against out-of-order delivery).
   */
  replaceState(remote: MatchState<G>): boolean {
    if (remote.version < this.state.version) return false;
    this.state = remote;
    // Remote snapshots are authoritative; local undo history no longer applies.
    this.undoStack = [];
    this.redoStack = [];
    this.lastError = null;
    this.emit();
    return true;
  }
}
