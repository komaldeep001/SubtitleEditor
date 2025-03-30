"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react"
import { formatTime } from "@/lib/time-utils"

interface VideoPlayerProps {
  url: string
  onTimeUpdate: (time: number) => void
  currentTime: number
  onPlayStateChange: (isPlaying: boolean) => void
  videoRef: React.RefObject<HTMLVideoElement>
  currentSubtitle?: string
}

export default function VideoPlayer({
  url,
  onTimeUpdate,
  currentTime,
  onPlayStateChange,
  videoRef,
  currentSubtitle,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isYouTube, setIsYouTube] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setIsYouTube(url.includes("youtube.com/embed/"))
  }, [url])

  useEffect(() => {
    const video = videoRef.current
    if (!video || isYouTube) return

    const handleDurationChange = () => {
      setDuration(video.duration)
    }

    const handleTimeUpdate = () => {
      onTimeUpdate(video.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      onPlayStateChange(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
      onPlayStateChange(false)
    }

    video.addEventListener("loadedmetadata", handleDurationChange)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)

    return () => {
      video.removeEventListener("loadedmetadata", handleDurationChange)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
    }
  }, [onTimeUpdate, isYouTube, onPlayStateChange, videoRef])

  useEffect(() => {
    if (!isYouTube && videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime, isYouTube, videoRef])

  const togglePlay = () => {
    if (!videoRef.current || isYouTube) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
  }

  const toggleMute = () => {
    if (!videoRef.current || isYouTube) return

    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current || isYouTube) return

    const newVolume = value[0]
    videoRef.current.volume = newVolume
    setVolume(newVolume)

    if (newVolume === 0) {
      setIsMuted(true)
      videoRef.current.muted = true
    } else if (isMuted) {
      setIsMuted(false)
      videoRef.current.muted = false
    }
  }

  const handleSeek = (value: number[]) => {
    if (!videoRef.current || isYouTube) return

    const newTime = value[0]
    videoRef.current.currentTime = newTime
    onTimeUpdate(newTime)
  }

  const toggleFullscreen = () => {
    if (!videoRef.current || isYouTube) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoRef.current.requestFullscreen()
    }
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-black aspect-video"
      tabIndex={0} // Make the container focusable
    >
      {isYouTube ? (
        <iframe
          ref={iframeRef}
          src={`${url}?enablejsapi=1`}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        ></iframe>
      ) : (
        <>
          <video ref={videoRef} className="w-full h-full" src={url} />

          {/* Subtitle overlay */}
          {currentSubtitle && (
            <div className="absolute bottom-16 left-0 right-0 text-center">
              <div className="inline-block bg-black/70 text-white px-4 py-2 rounded-md text-lg max-w-[80%]">
                {currentSubtitle}
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.01}
              onValueChange={handleSeek}
              className="mb-4"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" onClick={togglePlay} className="text-white">
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>

                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={toggleMute} className="text-white">
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>

                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="w-24"
                  />
                </div>

                <span className="text-xs text-white">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <Button size="icon" variant="ghost" onClick={toggleFullscreen} className="text-white">
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

