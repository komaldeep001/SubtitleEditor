"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, AlertTriangle } from "lucide-react"
import VideoPlayer from "@/components/video-player"
import SubtitleList from "@/components/subtitle-list"
import SubtitleTimeline from "@/components/subtitle-timeline"
import ConfirmDialog from "@/components/confirm-dialog"
import type { Subtitle } from "@/types/subtitle"
import { parseSRT, generateSRT } from "@/lib/srt-utils"

export default function SubtitleEditor() {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [youtubeLink, setYoutubeLink] = useState<string>("")
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [activeSubtitle, setActiveSubtitle] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const srtInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const isTypingRef = useRef(false)

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedSubtitles = localStorage.getItem("subtitles")
    const savedVideoUrl = localStorage.getItem("videoUrl")
    const savedYoutubeLink = localStorage.getItem("youtubeLink")

    if (savedSubtitles) {
      try {
        setSubtitles(JSON.parse(savedSubtitles))
      } catch (e) {
        console.error("Failed to parse saved subtitles", e)
      }
    }

    if (savedVideoUrl) {
      // Check if it's a blob URL (which won't work after refresh)
      if (savedVideoUrl.startsWith("blob:")) {
        setMediaError("The previously loaded media file is no longer available. Please upload it again.")
        localStorage.removeItem("videoUrl")
      } else {
        setVideoUrl(savedVideoUrl)
      }
    }

    if (savedYoutubeLink) {
      setYoutubeLink(savedYoutubeLink)
    }
  }, [])

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (subtitles.length > 0) {
      localStorage.setItem("subtitles", JSON.stringify(subtitles))
    }

    if (videoUrl) {
      localStorage.setItem("videoUrl", videoUrl)
    }

    if (youtubeLink) {
      localStorage.setItem("youtubeLink", youtubeLink)
    }
  }, [subtitles, videoUrl, youtubeLink])

  useEffect(() => {
    if (videoUrl && subtitles.length === 0) {
      handleAddSubtitle()
    }
  }, [videoUrl, subtitles.length])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const videoUrl = URL.createObjectURL(file)
      setVideoUrl(videoUrl)
      setMediaError(null)
    }
  }

  const handleSRTUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const text = await file.text()
      const parsedSubtitles = parseSRT(text)
      setSubtitles(parsedSubtitles)
    }
  }

  const handleYoutubeLink = () => {
    if (youtubeLink) {
      // Extract video ID from YouTube link
      const videoId = youtubeLink.match(
        /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
      )?.[1]
      if (videoId) {
        setVideoUrl(`https://www.youtube.com/embed/${videoId}`)
        setMediaError(null)
      }
    }
  }

  const handleCreateNew = () => {
    setSubtitles([
      {
        id: 1,
        startTime: 0,
        endTime: 5,
        text: "New subtitle",
        cps: 0,
      },
    ])
  }

  const handleUpdateSubtitle = (updatedSubtitle: Subtitle) => {
    // Calculate CPS (Characters Per Second)
    const duration = updatedSubtitle.endTime - updatedSubtitle.startTime
    const charCount = updatedSubtitle.text.replace(/\s/g, "").length
    const cps = duration > 0 ? Math.round((charCount / duration) * 10) / 10 : 0

    const updated = {
      ...updatedSubtitle,
      cps,
    }

    setSubtitles(subtitles.map((sub) => (sub.id === updatedSubtitle.id ? updated : sub)))
  }

  const handleAddSubtitle = () => {
    const lastSubtitle = subtitles[subtitles.length - 1]
    const newId = lastSubtitle ? lastSubtitle.id + 1 : 1
    const newStartTime = lastSubtitle ? lastSubtitle.endTime + 0.001 : 0
    const newEndTime = lastSubtitle ? lastSubtitle.endTime + 5 : 5

    const newSubtitle: Subtitle = {
      id: newId,
      startTime: newStartTime,
      endTime: newEndTime,
      text: "",
      cps: 0,
    }

    setSubtitles([...subtitles, newSubtitle])
    setActiveSubtitle(newId)
  }

  const handleDeleteSubtitle = (id: number) => {
    setSubtitles(subtitles.filter((sub) => sub.id !== id))
    if (activeSubtitle === id) {
      setActiveSubtitle(null)
    }
  }

  const handleExport = () => {
    const srtContent = generateSRT(subtitles)
    const blob = new Blob([srtContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "subtitles.srt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Use a debounced version of onTimeUpdate to prevent excessive updates during typing
  const onTimeUpdate = useCallback(
    (time: number) => {
      if (isTypingRef.current) return

      setCurrentTime(time)

      // Find active subtitle based on current time
      const active = subtitles.find((sub) => time >= sub.startTime && time <= sub.endTime)

      if (active) {
        setActiveSubtitle(active.id)
      }
    },
    [subtitles],
  )

  const handleCreateSubtitleAtEnter = (id: number) => {
    // Find the current subtitle
    const currentSubtitle = subtitles.find((sub) => sub.id === id)
    if (!currentSubtitle) return

    // Set the end time of the current subtitle to the current video time
    const updatedCurrentSubtitle = {
      ...currentSubtitle,
      endTime: currentTime,
    }

    // Calculate CPS for the updated subtitle
    const duration = updatedCurrentSubtitle.endTime - updatedCurrentSubtitle.startTime
    const charCount = updatedCurrentSubtitle.text.replace(/\s/g, "").length
    const cps = duration > 0 ? Math.round((charCount / duration) * 10) / 10 : 0

    updatedCurrentSubtitle.cps = cps

    // Create a new subtitle starting right after the current one
    const newId = Math.max(...subtitles.map((s) => s.id)) + 1
    const newSubtitle: Subtitle = {
      id: newId,
      startTime: currentTime + 0.001,
      endTime: currentTime + 5,
      text: "",
      cps: 0,
    }

    // Update the subtitles array
    setSubtitles(
      [...subtitles.map((sub) => (sub.id === id ? updatedCurrentSubtitle : sub)), newSubtitle].sort(
        (a, b) => a.startTime - b.startTime,
      ),
    )

    // Set the new subtitle as active
    setActiveSubtitle(newId)
  }

  const handleNewProject = () => {
    setShowConfirm({
      isOpen: true,
      title: "Start New Project",
      message: "This will clear all subtitles and media. Are you sure you want to continue?",
      onConfirm: () => {
        setSubtitles([])
        setVideoUrl("")
        setYoutubeLink("")
        localStorage.removeItem("subtitles")
        localStorage.removeItem("videoUrl")
        localStorage.removeItem("youtubeLink")
      },
    })
  }

  const handleNewSubtitles = () => {
    setShowConfirm({
      isOpen: true,
      title: "New Subtitles",
      message: "This will clear all existing subtitles. Are you sure you want to continue?",
      onConfirm: () => {
        setSubtitles([])
        if (videoRef.current) {
          videoRef.current.currentTime = 0
        }
        handleAddSubtitle()
      },
    })
  }

  const handleReplaceMedia = () => {
    setShowConfirm({
      isOpen: true,
      title: "Replace Media",
      message: "This will replace the current media. Are you sure you want to continue?",
      onConfirm: () => {
        setVideoUrl("")
        setYoutubeLink("")
        fileInputRef.current?.click()
      },
    })
  }

  const handleClearSubtitles = () => {
    setShowConfirm({
      isOpen: true,
      title: "Clear Subtitles",
      message: "This will clear all subtitles. Are you sure you want to continue?",
      onConfirm: () => {
        setSubtitles([])
        setActiveSubtitle(null)
        localStorage.removeItem("subtitles")
      },
    })
  }

  const handleSplitSubtitle = (id: number, cursorPosition: number, text: string) => {
    const subtitle = subtitles.find((sub) => sub.id === id)
    if (!subtitle) return

    // Split the text at cursor position
    const firstPart = text.substring(0, cursorPosition)
    const secondPart = text.substring(cursorPosition)

    // Calculate time split based on character ratio
    const totalChars = text.length
    const firstPartRatio = firstPart.length / totalChars
    const duration = subtitle.endTime - subtitle.startTime
    const splitTime = subtitle.startTime + duration * firstPartRatio

    // Create two new subtitles
    const firstSubtitle: Subtitle = {
      ...subtitle,
      text: firstPart,
      endTime: splitTime,
      cps: calculateCPS(firstPart, subtitle.startTime, splitTime),
    }

    const newId = Math.max(...subtitles.map((s) => s.id)) + 1
    const secondSubtitle: Subtitle = {
      id: newId,
      startTime: splitTime + 0.001,
      endTime: subtitle.endTime,
      text: secondPart,
      cps: calculateCPS(secondPart, splitTime + 0.001, subtitle.endTime),
    }

    // Replace the original subtitle with the two new ones
    const updatedSubtitles = subtitles
      .filter((sub) => sub.id !== id)
      .concat([firstSubtitle, secondSubtitle])
      .sort((a, b) => a.startTime - b.startTime)

    setSubtitles(updatedSubtitles)
    setActiveSubtitle(newId)
  }

  const calculateCPS = (text: string, startTime: number, endTime: number) => {
    const charCount = text.replace(/\s/g, "").length
    const duration = endTime - startTime
    return duration > 0 ? Math.round((charCount / duration) * 10) / 10 : 0
  }

  const filteredSubtitles = searchQuery
    ? subtitles.filter(
        (sub) => sub.text.toLowerCase().includes(searchQuery.toLowerCase()) || String(sub.id).includes(searchQuery),
      )
    : subtitles

  // Ensure no overlapping subtitles
  useEffect(() => {
    const sortedSubtitles = [...subtitles].sort((a, b) => a.startTime - b.startTime)
    let hasOverlap = false
    const newSubtitles = sortedSubtitles.map((sub, i) => {
      if (i < sortedSubtitles.length - 1 && sub.endTime > sortedSubtitles[i + 1].startTime) {
        hasOverlap = true
        return { ...sub, endTime: sortedSubtitles[i + 1].startTime - 0.001 }
      }
      return sub
    })

    // Only update if there are changes
    if (hasOverlap && JSON.stringify(newSubtitles) !== JSON.stringify(subtitles)) {
      setSubtitles(newSubtitles)
    }
  }, [subtitles])

  // Find current subtitle for display
  const currentSubtitle = subtitles.find((sub) => currentTime >= sub.startTime && currentTime <= sub.endTime)

  const handleSelectSubtitle = (id: number) => {
    setActiveSubtitle(id)
    const subtitle = subtitles.find((sub) => sub.id === id)
    if (subtitle && videoRef.current) {
      videoRef.current.currentTime = subtitle.startTime
      setCurrentTime(subtitle.startTime)
    }
  }

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const setTypingState = (isTyping: boolean) => {
    isTypingRef.current = isTyping
  }

  // Add keyboard event handlers for the requested shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // TAB to play/pause
      if (e.key === "Tab" && !e.altKey && !e.ctrlKey) {
        e.preventDefault()
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause()
          } else {
            videoRef.current.play()
          }
        }
      }

      // SHIFT+TAB to rewind by 5 seconds
      if (e.key === "Tab" && e.shiftKey && !e.altKey && !e.ctrlKey) {
        e.preventDefault()
        if (videoRef.current) {
          const newTime = Math.max(0, videoRef.current.currentTime - 5)
          videoRef.current.currentTime = newTime
          onTimeUpdate(newTime)
        }
      }

      // SHIFT+ALT to forward by 5 seconds
      if (e.shiftKey && e.altKey && !e.ctrlKey) {
        e.preventDefault()
        if (videoRef.current) {
          const newTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 5)
          videoRef.current.currentTime = newTime
          onTimeUpdate(newTime)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isPlaying, onTimeUpdate])

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleNewProject} className="text-sm">
            New Project
          </Button>
          <Button variant="ghost" onClick={handleNewSubtitles} className="text-sm">
            New Subtitles
          </Button>
          <Button variant="ghost" onClick={handleClearSubtitles} className="text-sm">
            Clear Subtitles
          </Button>
          <Button variant="ghost" onClick={handleReplaceMedia} className="text-sm">
            Replace Media
          </Button>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-40"
            />
          </div>
        </div>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700">
          Export
        </Button>
      </header>

      {!videoUrl || subtitles.length === 0 || mediaError ? (
        <div className="grid gap-8 place-content-center h-full">
          {(!videoUrl || mediaError) && (
            <div className="bg-card rounded-lg p-8 flex flex-col items-center gap-6">
              <h2 className="text-xl font-semibold">Select a video to get started</h2>

              {mediaError && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md">
                  <AlertTriangle className="h-5 w-5" />
                  <p>{mediaError}</p>
                </div>
              )}

              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-64 h-12">
                Select video or audio file
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="video/*,audio/*"
                className="hidden"
              />
              <div className="text-muted-foreground">or</div>
              <div className="w-full max-w-md">
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste YouTube link"
                    value={youtubeLink}
                    onChange={(e) => setYoutubeLink(e.target.value)}
                  />
                  <Button onClick={handleYoutubeLink} variant="outline">
                    Load
                  </Button>
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  Note: YouTube videos have limited functionality. For best experience, download the video and use it
                  directly.
                </p>
              </div>
            </div>
          )}

          {subtitles.length === 0 && videoUrl && !mediaError && (
            <div className="bg-card rounded-lg p-8 flex flex-col items-center gap-6">
              <h2 className="text-xl font-semibold">Add Subtitles</h2>
              <Button onClick={() => srtInputRef.current?.click()} variant="outline" className="w-64 h-12">
                Upload SRT/VTT
              </Button>
              <input type="file" ref={srtInputRef} onChange={handleSRTUpload} accept=".srt,.vtt" className="hidden" />
              <Button onClick={handleCreateNew} className="w-64 h-12 bg-indigo-600 hover:bg-indigo-700">
                Create Manually
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-1 overflow-hidden">
            <div className="w-3/5 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <SubtitleList
                  subtitles={filteredSubtitles}
                  activeSubtitle={activeSubtitle}
                  onSelectSubtitle={handleSelectSubtitle}
                  onUpdateSubtitle={handleUpdateSubtitle}
                  onDeleteSubtitle={handleDeleteSubtitle}
                  currentTime={currentTime}
                  onCreateSubtitleAtEnter={handleCreateSubtitleAtEnter}
                  onSplitSubtitle={handleSplitSubtitle}
                  onTypingStateChange={setTypingState}
                />
              </div>
            </div>

            <div className="w-2/5 flex flex-col border-l overflow-hidden">
              <div className="flex-1 p-4 flex flex-col">
                {videoUrl && (
                  <VideoPlayer
                    url={videoUrl}
                    onTimeUpdate={onTimeUpdate}
                    currentTime={currentTime}
                    onPlayStateChange={setIsPlaying}
                    videoRef={videoRef}
                    currentSubtitle={
                      subtitles.find((sub) => currentTime >= sub.startTime && currentTime <= sub.endTime)?.text
                    }
                  />
                )}
                <div className="mt-2 mb-4 text-xs text-gray-500 space-y-1">
                  <div>Keyboard shortcuts:</div>
                  <div>
                    <kbd className="px-1 py-0.5 bg-gray-100 border rounded">Tab</kbd> Play/Pause
                  </div>
                  <div>
                    <kbd>Shift</kbd> + <kbd>Tab</kbd> Rewind 5s
                  </div>
                  <div>
                    <kbd>Shift</kbd> + <kbd>Alt</kbd> Forward 5s
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-4">
            <SubtitleTimeline
              subtitles={subtitles}
              currentTime={currentTime}
              activeSubtitle={activeSubtitle}
              onSelectSubtitle={setActiveSubtitle}
              onUpdateSubtitle={handleUpdateSubtitle}
              isPlaying={isPlaying}
              onSeek={handleSeek}
            />
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      {showConfirm.isOpen && (
        <ConfirmDialog
          title={showConfirm.title}
          message={showConfirm.message}
          onConfirm={() => {
            showConfirm.onConfirm()
            setShowConfirm({ ...showConfirm, isOpen: false })
          }}
          onCancel={() => setShowConfirm({ ...showConfirm, isOpen: false })}
        />
      )}
    </div>
  )
}

