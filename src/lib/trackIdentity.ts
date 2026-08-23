import type { Track, Trajectory } from '../types'

export function qualifiedTrackId(cameraId: string, trackId: string): string {
  return `${cameraId.replace('cam-i24v-', '')}:${trackId}`
}

export function trajectorySelectsTrack(
  trajectory: Trajectory | undefined,
  track: Pick<Track, 'cameraId' | 'trackId'>,
): boolean {
  if (!trajectory) return false
  const cameraIndex = trajectory.timeline.findIndex(
    (segment) => segment.cameraId === track.cameraId,
  )
  if (cameraIndex === 0) return trajectory.leftTrackId === track.trackId
  if (cameraIndex === 1) return trajectory.rightTrackId === track.trackId
  return false
}
