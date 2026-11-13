/** A clear/delete changed the conversation; retrying the same work could resurrect it. */
export class SessionPersistenceConflict extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionPersistenceConflict';
    }
}
