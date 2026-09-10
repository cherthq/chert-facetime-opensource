export interface FaceTimeGuestOptions {
  /** An iPhone-created https://facetime.apple.com/join link. */
  faceTimeLink: string;
  livekitUrl: string;
  /** A room-scoped publish/subscribe token, expiring within one hour. */
  roomToken: string;
  /** The participant publishing one audio track and one avatar video track. */
  agentIdentity: string;
  signal?: AbortSignal;
}
export interface FaceTimeGuestStatus {
  closed: boolean;
  roomConnected: boolean;
  /** Selected publications; these flags do not prove delivery to the iPhone. */
  audio: boolean;
  video: boolean;
  mediaLinkConnected: boolean;
}
export declare class FaceTimeGuest {
  private constructor();
  static open(options: FaceTimeGuestOptions): Promise<FaceTimeGuest>;
  /** Resolves when cleanup finishes, including after a browser Stop or closure. */
  readonly closed: Promise<void>;
  /** Call after the human has joined and been admitted. Never bypasses admission. */
  connect(): Promise<FaceTimeGuestStatus>;
  status(): Promise<FaceTimeGuestStatus>;
  /** Idempotent. Closes the connector, not the user's independently hosted agent. */
  close(): Promise<void>;
}
