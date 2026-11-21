export interface BoardroomAssignment {
  requestId: string;
  stepId: string;
  agentId: string;
}

export interface BoardroomPageVersion {
  controlGeneration: number;
  navigationGeneration: number;
}

/** A transport must supply the assignment from the running mission, never from model arguments. */
export class BoardroomControl {
  private controller: 'artist' | 'specialist' | 'disconnected' | 'stopped' = 'artist';
  private assignment?: BoardroomAssignment;
  private controlGeneration = 0;
  private navigationGeneration = 0;

  get state() {
    return {
      controller: this.controller,
      specialistId: this.assignment?.agentId,
      controlGeneration: this.controlGeneration,
      navigationGeneration: this.navigationGeneration,
    };
  }

  giveControl(assignment: BoardroomAssignment, expected: BoardroomPageVersion): boolean {
    if (this.controller !== 'artist' || !this.isCurrent(expected)) return false;
    this.assignment = { ...assignment };
    this.controller = 'specialist';
    this.controlGeneration++;
    return true;
  }

  takeOver(): void {
    if (this.controller === 'artist' || this.controller === 'specialist') this.revoke('artist');
  }

  didNavigate(): void {
    this.navigationGeneration++;
  }

  disconnect(): void {
    if (this.controller !== 'stopped') this.revoke('disconnected');
  }

  reconnect(): void {
    if (this.controller === 'disconnected') this.revoke('artist');
  }

  stop(): void {
    this.revoke('stopped');
  }

  allowsSpecialist(assignment: BoardroomAssignment, expected: BoardroomPageVersion): boolean {
    const current = this.assignment;
    return this.controller === 'specialist' && this.isCurrent(expected)
      && assignment.requestId === current?.requestId
      && assignment.stepId === current.stepId
      && assignment.agentId === current.agentId;
  }

  allowsArtist(expected: BoardroomPageVersion): boolean {
    return this.controller === 'artist' && this.isCurrent(expected);
  }

  private isCurrent(expected: BoardroomPageVersion): boolean {
    return expected.controlGeneration === this.controlGeneration
      && expected.navigationGeneration === this.navigationGeneration;
  }

  private revoke(controller: 'artist' | 'disconnected' | 'stopped'): void {
    this.assignment = undefined;
    this.controller = controller;
    this.controlGeneration++;
  }
}
