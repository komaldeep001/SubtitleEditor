"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import VideoPlayer from "@/components/video-player"
import SubtitleList from "@/components/subtitle-list"
import SubtitleTimeline from "@/components/subtitle-timeline"
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const srtInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoUrl && subtitles.length === 0) {
      handleAddSubtitle();
    }
  }, [videoUrl, subtitles.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const videoUrl = URL.createObjectURL(file)
      setVideoUrl(videoUrl)
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

    setSubtitles(
      subtitles.map((sub) => (sub.id === updatedSubtitle.id ? updated : sub)),
    )
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

  const onTimeUpdate = (time: number) => {
    setCurrentTime(time)

    // Find active subtitle based on current time
    const active = subtitles.find(
      (sub) => time >= sub.startTime && time <= sub.endTime,
    )

    if (active) {
      setActiveSubtitle(active.id)
    }
  }

  // handleTimeUpdate is now using the onTimeUpdate function
  const handleTimeUpdate = onTimeUpdate

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
      [
        ...subtitles.map((sub) =>
          sub.id === id ? updatedCurrentSubtitle : sub,
        ),
        newSubtitle,
      ].sort((a, b) => a.startTime - b.startTime),
    )

    // Set the new subtitle as active
    setActiveSubtitle(newId)
  }

  const handleNewSubtitles = () => {
    setSubtitles([])
    if (videoRef.current) {
      videoRef.current.currentTime = 0
    }
    handleAddSubtitle()
  }

  const handleReplaceMedia = () => {
    setVideoUrl("");
    setYoutubeLink("");
    fileInputRef.current?.click();
  };

  const handleClearSubtitles = () => {
    setSubtitles([]);
    setActiveSubtitle(null);
  };

  const filteredSubtitles = searchQuery
    ? subtitles.filter(
        (sub) =>
          sub.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(sub.id).includes(searchQuery),
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
  const currentSubtitle = subtitles.find(
    (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime,
  )

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
          const newTime = Math.min(
            videoRef.current.duration || 0,
            videoRef.current.currentTime + 5,
          )
          videoRef.current.currentTime = newTime
          onTimeUpdate(newTime)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isPlaying])

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleNewSubtitles} className="text-sm">
            New subtitles
          </Button>
          <Button variant="ghost" onClick={handleClearSubtitles} className="text-sm">
            Clear subtitles
          </Button>
          <Button variant="ghost" onClick={handleReplaceMedia} className="text-sm">
            Replace media
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

      {!videoUrl || subtitles.length === 0 ? (
        <div className="grid gap-8 place-content-center h-full">
          {!videoUrl && (
            <div className="bg-card rounded-lg p-8 flex flex-col items-center gap-6">
              <h2 className="text-xl font-semibold">Select a video to get started</h2>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-64 h-12"
              >
                Select video file
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="video/*"
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
              </div>
            </div>
          )}

          {subtitles.length === 0 && (
            <div className="bg-card rounded-lg p-8 flex flex-col items-center gap-6">
              <h2 className="text-xl font-semibold">Add Subtitles</h2>
              <Button
                onClick={() => srtInputRef.current?.click()}
                variant="outline"
                className="w-64 h-12"
              >
                Upload SRT/VTT
              </Button>
              <input
                type="file"
                ref={srtInputRef}
                onChange={handleSRTUpload}
                accept=".srt,.vtt"
                className="hidden"
              />
              <Button 
                onClick={handleCreateNew}
                className="w-64 h-12 bg-indigo-600 hover:bg-indigo-700"
              >
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
                  onSelectSubtitle={setActiveSubtitle}
                  onUpdateSubtitle={handleUpdateSubtitle}
                  onDeleteSubtitle={handleDeleteSubtitle}
                  currentTime={currentTime}
                  onCreateSubtitleAtEnter={handleCreateSubtitleAtEnter}
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
                    currentSubtitle={subtitles.find(
                      sub => currentTime >= sub.startTime && currentTime <= sub.endTime
                    )?.text}
                  />
                )}
                <div className="mt-2 mb-4 text-xs text-gray-500 space-y-1">
                  <div>Keyboard shortcuts:</div>
                  <div><kbd className="px-1 py-0.5 bg-gray-100 border rounded">Tab</kbd> Play/Pause</div>
                  <div><kbd>Shift</kbd> + <kbd>Tab</kbd> Rewind 5s</div>
                  <div><kbd>Shift</kbd> + <kbd>Alt</kbd> Forward 5s</div>
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
            />
          </div>
        </>
      )}
    </div>
  )
}