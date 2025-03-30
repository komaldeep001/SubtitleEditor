"use client"

import type React from "react"
import { useRef, useEffect, useState, useMemo } from "react"
import { formatTime } from "@/lib/time-utils"
import type { Subtitle } from "@/types/subtitle"

interface SubtitleTimelineProps {
  subtitles: Subtitle[]
  currentTime: number
  activeSubtitle: number | null
  onSelectSubtitle: (id: number) => void
  onUpdateSubtitle: (subtitle: Subtitle) => void
  isPlaying: boolean
}

export default function SubtitleTimeline({
  subtitles,
  currentTime,
  activeSubtitle,
  onSelectSubtitle,
  onUpdateSubtitle,
  isPlaying,
}: SubtitleTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineContentRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<{ id: number; type: "start" | "end" | "move" } | null>(null)
  const [timelineScale, setTimelineScale] = useState(100)
  const [containerWidth, setContainerWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [userInteracting, setUserInteracting] = useState(false)
  const userInteractionTimeout = useRef<number | null>(null)
  const [animatedTime, setAnimatedTime] = useState(currentTime)
  const maxDuration = useMemo(() => {
    return subtitles.length > 0 ? Math.max(...subtitles.map((s) => s.endTime)) + 30 : 60
  }, [subtitles])
  const contentWidth = maxDuration * timelineScale

  useEffect(() => {
    if (!isPlaying) {
      setAnimatedTime(currentTime)
      return
    }

    const interval = setInterval(() => {
      setAnimatedTime(prev => prev + (currentTime - prev) * 0.1)
    }, 10)

    return () => clearInterval(interval)
  }, [isPlaying, currentTime])

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      setScrollLeft(container.scrollLeft)
    }
    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!isPlaying || !containerRef.current) return;
  
    const container = containerRef.current;
    let interval: number;
  
    const updateScroll = () => {
      if (userInteracting) return;
  
      const desired = Math.max(
        0,
        Math.min(currentTime * timelineScale - containerWidth / 2, contentWidth - containerWidth)
      );
  
      const diff = desired - container.scrollLeft;
      container.scrollLeft += diff * 0.05; // Reduce the step size for smoother motion
    };
  
    interval = window.setInterval(updateScroll, 10); // Run every 10ms
  
    return () => {
      window.clearInterval(interval);
    };
  }, [isPlaying, currentTime, timelineScale, containerWidth, contentWidth, userInteracting]);
  

  const secondsToPixels = (seconds: number) => seconds * timelineScale

  const handleMouseDown = (e: React.MouseEvent, id: number, type: "start" | "end" | "move") => {
    e.preventDefault()
    setIsDragging({ id, type })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + containerRef.current.scrollLeft
      const timePosition = x / timelineScale

      const subtitle = subtitles.find((s) => s.id === isDragging.id)
      if (!subtitle) return

      const sortedSubtitles = [...subtitles].sort((a, b) => a.startTime - b.startTime)
      const currentIndex = sortedSubtitles.findIndex((s) => s.id === subtitle.id)
      const prevSubtitle = currentIndex > 0 ? sortedSubtitles[currentIndex - 1] : null
      const nextSubtitle = currentIndex < sortedSubtitles.length - 1 ? sortedSubtitles[currentIndex + 1] : null

      if (isDragging.type === "start") {
        const newStartTime = Math.max(0, Math.min(subtitle.endTime - 0.1, timePosition))
        const minStartTime = prevSubtitle ? prevSubtitle.endTime + 0.001 : 0
        onUpdateSubtitle({
          ...subtitle,
          startTime: Math.max(minStartTime, newStartTime),
        })
      } else if (isDragging.type === "end") {
        const newEndTime = Math.max(subtitle.startTime + 0.1, timePosition)
        const maxEndTime = nextSubtitle ? nextSubtitle.startTime - 0.001 : Number.POSITIVE_INFINITY
        onUpdateSubtitle({
          ...subtitle,
          endTime: Math.min(maxEndTime, newEndTime),
        })
      } else if (isDragging.type === "move") {
        const duration = subtitle.endTime - subtitle.startTime
        const minStartTime = prevSubtitle ? prevSubtitle.endTime + 0.001 : 0
        const maxEndTime = nextSubtitle ? nextSubtitle.startTime - 0.001 : Number.POSITIVE_INFINITY
        let newStart = Math.max(minStartTime, timePosition)
        if (newStart + duration > maxEndTime) {
          newStart = maxEndTime - duration
        }
        onUpdateSubtitle({
          ...subtitle,
          startTime: newStart,
          endTime: newStart + duration,
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, subtitles, onUpdateSubtitle, timelineScale])

  const handleZoomIn = () => {
    setTimelineScale((prev) => Math.min(prev * 1.5, 500))
  }
  const handleZoomOut = () => {
    setTimelineScale((prev) => Math.max(prev / 1.5, 30))
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current) {
      e.preventDefault()
      containerRef.current.scrollLeft += e.deltaY * 0.01 * timelineScale
      setUserInteracting(true)
      if (userInteractionTimeout.current) {
        window.clearTimeout(userInteractionTimeout.current)
      }
      userInteractionTimeout.current = window.setTimeout(() => {
        setUserInteracting(false)
      }, 2000)
    }
  }

  const renderTimeMarkers = () => {
    const markers = []
    let interval = 1
    if (timelineScale < 50) interval = 5
    if (timelineScale < 20) interval = 10
    if (timelineScale < 10) interval = 30

    for (let i = 0; i <= maxDuration; i += interval) {
      const position = secondsToPixels(i)
      if (position < -50 || position > contentWidth + 50) continue
      markers.push(
        <div
          key={`main-${i}`}
          className="absolute top-0 bottom-0 border-l border-gray-300 dark:border-gray-700"
          style={{ left: position }}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1">{formatTime(i)}</div>
        </div>
      )
    }

    if (timelineScale >= 100) {
      const smallInterval = 0.1
      for (let i = 0; i <= maxDuration; i += smallInterval) {
        if (i % interval === 0) continue
        const position = secondsToPixels(i)
        if (position < -50 || position > contentWidth + 50) continue
        markers.push(
          <div
            key={`small-${i}`}
            className="absolute top-6 h-2 border-l border-gray-200 dark:border-gray-800"
            style={{ left: position }}
          />
        )
      }
    }
    return markers
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">Timeline</h3>
        <div className="flex gap-2">
          <button onClick={handleZoomOut} className="px-2 py-1 text-xs rounded border hover:bg-muted">
            Zoom Out
          </button>
          <button onClick={handleZoomIn} className="px-2 py-1 text-xs rounded border hover:bg-muted">
            Zoom In
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[150px] overflow-x-auto border rounded bg-muted/20"
        onWheel={handleWheel}
      >
        <div ref={timelineContentRef} style={{ width: contentWidth, position: "relative", height: "100%" }}>
          <div className="absolute top-0 left-0 h-6 w-full bg-muted/30">{renderTimeMarkers()}</div>
          <div className="absolute top-8 left-0 right-0 bottom-0">
            {subtitles.map((subtitle) => {
              const left = secondsToPixels(subtitle.startTime)
              const width = (subtitle.endTime - subtitle.startTime) * timelineScale
              const fadeDistance = 50
              const right = left + width
              if (right < -fadeDistance || left > contentWidth + fadeDistance) return null
              const opacity = right < fadeDistance ? Math.max(0, right / fadeDistance) : 1

              return (
                <div
                  key={subtitle.id}
                  className={`absolute h-8 rounded-md flex items-center overflow-hidden cursor-move border-2 ${
                    activeSubtitle === subtitle.id
                      ? "border-primary bg-primary/20"
                      : "border-gray-300 dark:border-gray-700 bg-card hover:bg-muted"
                  }`}
                  style={{
                    left,
                    width: Math.max(10, width),
                    top: "0px",
                    opacity,
                  }}
                  onClick={() => onSelectSubtitle(subtitle.id)}
                  onMouseDown={(e) => handleMouseDown(e, subtitle.id, "move")}
                >
                  <div className="px-2 truncate text-xs">{subtitle.text || `#${subtitle.id}`}</div>
                  <div
                    className="absolute left-0 top-0 bottom-0 w-4 cursor-w-resize hover:bg-blue-200"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      handleMouseDown(e, subtitle.id, "start")
                    }}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-e-resize hover:bg-blue-200"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      handleMouseDown(e, subtitle.id, "end")
                    }}
                  />
                </div>
              )
            })}
          </div>
          {/* Corrected red line position */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10"
            style={{ left: animatedTime  * timelineScale }}
          />
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Press Enter after typing to create a new subtitle at the current playback position
      </div>
    </div>
  )
}