"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Maximize, Music } from "lucide-react"
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
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null)
  const [showControls, setShowControls] = useState(true)
  const [isAudio, setIsAudio] = useState(false)
  const youtubeContainerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const controlsTimeoutRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsYouTube(url.includes("youtube.com"))
    setIsAudio(url.match(/\.(mp3|wav|ogg|aac|flac)$/i) !== null)

    // Reset YouTube player when URL changes
    if (url.includes("youtube.com")) {
      initYouTubePlayer(url)
    }
  }, [url])

  // Initialize YouTube player
  const initYouTubePlayer = (url: string) => {
    // Only load YouTube API once
    if (!window.YT && !document.getElementById("youtube-api")) {
      const tag = document.createElement("script")
      tag.id = "youtube-api"
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

      // Define callback for when API is ready
      window.onYouTubeIframeAPIReady = () => {
        createYouTubePlayer(url)
      }
    } else if (window.YT && window.YT.Player) {
      createYouTubePlayer(url)
    }
  }

  const createYouTubePlayer = (url: string) => {
    if (!youtubeContainerRef.current) return

    // Extract video ID from URL
    const videoId = url.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
    )?.[1]
    if (!videoId) return

    // Create player
    const player = new window.YT.Player(youtubeContainerRef.current, {
      videoId: videoId,
      playerVars: {
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: (event: any) => {
          setYoutubePlayer(event.target)
          setDuration(event.target.getDuration())
        },
        onStateChange: (event: any) => {
          const isPlaying = event.data === window.YT.PlayerState.PLAYING
          setIsPlaying(isPlaying)
          onPlayStateChange(isPlaying)

          // Update time continuously when playing
          if (isPlaying) {
            const timeUpdateInterval = setInterval(() => {
              if (event.target) {
                const currentTime = event.target.getCurrentTime()
                onTimeUpdate(currentTime)
              }
            }, 100)

            return () => clearInterval(timeUpdateInterval)
          }
        },
      },
    })
  }

  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current

    if (isYouTube) return

    const mediaElement = isAudio ? audio : video
    if (!mediaElement) return

    const handleDurationChange = () => {
      setDuration(mediaElement.duration)
    }

    const handleTimeUpdate = () => {
      onTimeUpdate(mediaElement.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      onPlayStateChange(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
      onPlayStateChange(false)
    }

    mediaElement.addEventListener("loadedmetadata", handleDurationChange)
    mediaElement.addEventListener("timeupdate", handleTimeUpdate)
    mediaElement.addEventListener("play", handlePlay)
    mediaElement.addEventListener("pause", handlePause)

    return () => {
      mediaElement.removeEventListener("loadedmetadata", handleDurationChange)
      mediaElement.removeEventListener("timeupdate", handleTimeUpdate)
      mediaElement.removeEventListener("play", handlePlay)
      mediaElement.removeEventListener("pause", handlePause)
    }
  }, [onTimeUpdate, isYouTube, onPlayStateChange, videoRef, isAudio])

  useEffect(() => {
    if (isYouTube && youtubePlayer && Math.abs(youtubePlayer.getCurrentTime() - currentTime) > 0.5) {
      youtubePlayer.seekTo(currentTime)
    } else if (isAudio && audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
      audioRef.current.currentTime = currentTime
    } else if (
      !isYouTube &&
      !isAudio &&
      videoRef.current &&
      Math.abs(videoRef.current.currentTime - currentTime) > 0.5
    ) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime, isYouTube, videoRef, youtubePlayer, isAudio])

  // Auto-hide controls
  useEffect(() => {
    const startHideTimer = () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current)
      }

      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    if (isPlaying) {
      startHideTimer()
    } else {
      setShowControls(true)
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current)
      }
    }

    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isPlaying])

  const handleMouseMove = () => {
    setShowControls(true)

    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current)
    }

    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  const togglePlay = () => {
    if (isYouTube && youtubePlayer) {
      if (isPlaying) {
        youtubePlayer.pauseVideo()
      } else {
        youtubePlayer.playVideo()
      }
    } else if (isAudio && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    } else if (!isYouTube && !isAudio && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const toggleMute = () => {
    if (isYouTube && youtubePlayer) {
      if (isMuted) {
        youtubePlayer.unMute()
        setIsMuted(false)
      } else {
        youtubePlayer.mute()
        setIsMuted(true)
      }
    } else if (isAudio && audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    } else if (!isYouTube && !isAudio && videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]

    if (isYouTube && youtubePlayer) {
      youtubePlayer.setVolume(newVolume * 100)
      setVolume(newVolume)

      if (newVolume === 0) {
        youtubePlayer.mute()
        setIsMuted(true)
      } else if (isMuted) {
        youtubePlayer.unMute()
        setIsMuted(false)
      }
    } else if (isAudio && audioRef.current) {
      audioRef.current.volume = newVolume
      setVolume(newVolume)

      if (newVolume === 0) {
        setIsMuted(true)
        audioRef.current.muted = true
      } else if (isMuted) {
        setIsMuted(false)
        audioRef.current.muted = false
      }
    } else if (!isYouTube && !isAudio && videoRef.current) {
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
  }

  const handleSeek = (value: number[]) => {
    const newTime = value[0]

    if (isYouTube && youtubePlayer) {
      youtubePlayer.seekTo(newTime)
      onTimeUpdate(newTime)
    } else if (isAudio && audioRef.current) {
      audioRef.current.currentTime = newTime
      onTimeUpdate(newTime)
    } else if (!isYouTube && !isAudio && videoRef.current) {
      videoRef.current.currentTime = newTime
      onTimeUpdate(newTime)
    }
  }

  const toggleFullscreen = () => {
    if (isYouTube) {
      // For YouTube, we can't directly control fullscreen
      // but we can open in a new tab
      const videoId = url.match(
        /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
      )?.[1]
      if (videoId) {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank")
      }
    } else if (isAudio) {
      // For audio, fullscreen doesn't make sense
      return
    } else if (!isYouTube && !isAudio && videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        videoRef.current.requestFullscreen()
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg bg-black aspect-video"
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onClick={() => setShowControls(true)}
    >
      {isYouTube ? (
        <div className="w-full h-full">
          <div ref={youtubeContainerRef} className="w-full h-full"></div>
        </div>
      ) : isAudio ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
          <audio ref={audioRef} src={url} className="hidden" />
          <Music className="w-24 h-24 text-gray-400" />
        </div>
      ) : (
        <video ref={videoRef} className="w-full h-full" src={url} />
      )}

      {/* Subtitle overlay */}
      {currentSubtitle && (
        <div className="absolute bottom-16 left-0 right-0 text-center">
          <div className="inline-block bg-black/70 text-white px-4 py-2 rounded-md text-lg max-w-[80%]">
            {currentSubtitle}
          </div>
        </div>
      )}

      {/* Controls overlay - conditionally shown */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
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

          {!isAudio && (
            <Button size="icon" variant="ghost" onClick={toggleFullscreen} className="text-white">
              <Maximize className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

