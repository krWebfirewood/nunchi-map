export type DateLike = Date | string;
export interface TimeRange { startMinutes: number; endMinutes: number }
export interface Coordinates { latitude: number; longitude: number }
export interface ConflictSchedule extends TimeRange, Coordinates { date: DateLike; radiusMeters: number }
export interface ConflictResult { isConflict: boolean; sameDate: boolean; timeOverlap: boolean; spatialOverlap: boolean; distanceMeters: number }
