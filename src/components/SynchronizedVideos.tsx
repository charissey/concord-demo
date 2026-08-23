import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Camera, Detection, Track, Trajectory } from '../types'
import { formatSeconds, frameAt } from '../lib/replay'
import { qualifiedTrackId, trajectorySelectsTrack } from '../lib/trackIdentity'

interface Props {
  cameras: Camera[]
  duration: number
  stage: number
  detections: Detection[]
  tracks: Track[]
  selectedTrajectory?: Trajectory
  onTimeChange?: (time: number) => void
}

const asset = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

export function SynchronizedVideos({
  cameras,
  duration,
  stage,
  detections,
  tracks,
  selectedTrajectory,
  onTimeChange,
}: Props) {
  const refs = useRef<Array<HTMLVideoElement | null>>([])
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const fps = cameras[0]?.fps ?? 29.97
  const frame = frameAt(time, fps)

  const seek = (next: number) => {
    const clamped = Math.min(duration, Math.max(0, next))
    refs.current.forEach((video) => {
      if (video) video.currentTime = clamped
    })
    setTime(clamped)
    onTimeChange?.(clamped)
  }

  useEffect(() => {
    refs.current.forEach((video) => {
      if (!video) return
      if (playing) void video.play()
      else video.pause()
    })
  }, [playing])

  useEffect(() => {
    const interval = selectedTrajectory?.timeline[0]
    if (interval) seek(interval.entered)
    // A selected vehicle should seek once, not on every player tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrajectory?.vehicleId])

  const currentBoxes = useMemo(() => {
    const map = new Map<string, Array<Detection & { highlighted?: boolean }>>()
    if (stage >= 1) {
      detections
        .filter((item) => Math.abs(item.frame - frame) <= 1)
        .forEach((item) => {
          const rows = map.get(item.cameraId) ?? []
          rows.push(item)
          map.set(item.cameraId, rows)
        })
    }
    if (stage >= 2) {
      tracks.forEach((track) => {
        const box = track.boxes.find((item) => Math.abs(item.frame - frame) <= 1)
        if (!box) return
        const rows = map.get(track.cameraId) ?? []
        rows.push({
          frame: box.frame,
          cameraId: track.cameraId,
          bbox: box.bbox,
          confidence: track.confidence,
          vehicleClass: track.vehicleClass,
          color: track.color,
          subtype: track.subtype,
          trackId: track.trackId,
          highlighted: trajectorySelectsTrack(selectedTrajectory, track),
        })
        map.set(track.cameraId, rows)
      })
    }
    return map
  }, [detections, frame, selectedTrajectory, stage, tracks])

  return (
    <div className="video-workspace">
      <div className="video-grid">
        {cameras.map((camera, index) => (
          <figure className="camera" key={camera.id}>
            <div className="video-frame">
              <video
                ref={(node) => {
                  refs.current[index] = node
                }}
                src={asset(camera.video)}
                muted
                playsInline
                preload="metadata"
                onEnded={() => setPlaying(false)}
                onTimeUpdate={(event) => {
                  if (index !== 0) return
                  const next = event.currentTarget.currentTime
                  const peer = refs.current[1]
                  if (peer && Math.abs(peer.currentTime - next) > 0.08) {
                    peer.currentTime = next
                  }
                  setTime(next)
                  onTimeChange?.(next)
                }}
              />
              <svg
                className="overlay"
                viewBox={`0 0 ${camera.width} ${camera.height}`}
                aria-label={`${camera.label} annotations`}
              >
                {(currentBoxes.get(camera.id) ?? []).map((item, boxIndex) => {
                  const [x1, y1, x2, y2] = item.bbox
                  return (
                    <g
                      className={item.highlighted ? 'box highlight' : 'box'}
                      key={`${camera.id}-${item.trackId ?? item.vehicleClass}-${boxIndex}`}
                    >
                      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} />
                      <text x={x1} y={Math.max(18, y1 - 7)}>
                        {item.trackId
                          ? qualifiedTrackId(camera.id, item.trackId)
                          : item.vehicleClass}
                      </text>
                    </g>
                  )
                })}
              </svg>
              <span className="camera-badge">
                {camera.label} · {camera.id.endsWith('highway2') ? 'A' : 'B'}
              </span>
              <span className="frame-badge">frame {frame}</span>
            </div>
            <figcaption>{camera.id}</figcaption>
          </figure>
        ))}
      </div>

      <div className="player-controls" aria-label="Synchronized video controls">
        <button onClick={() => seek(0)} aria-label="Replay from start">
          <RotateCcw size={16} />
        </button>
        <button onClick={() => seek(time - 1 / fps)} aria-label="Previous frame">
          <ChevronLeft size={18} />
        </button>
        <button
          className="play-button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? 'Pause both videos' : 'Play both videos'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => seek(time + 1 / fps)} aria-label="Next frame">
          <ChevronRight size={18} />
        </button>
        <span className="time">{formatSeconds(time)}</span>
        <input
          aria-label="Video timeline"
          type="range"
          min={0}
          max={duration}
          step={1 / fps}
          value={time}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="time">{formatSeconds(duration)}</span>
      </div>
    </div>
  )
}
