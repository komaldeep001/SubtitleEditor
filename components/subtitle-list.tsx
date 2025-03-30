"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Trash2 } from "lucide-react"
import { formatTimeCode } from "@/lib/time-utils"
import type { Subtitle } from "@/types/subtitle"

interface SubtitleListProps {
  subtitles: Subtitle[]
  activeSubtitle: number | null
  onSelectSubtitle: (id: number) => void
  onUpdateSubtitle: (subtitle: Subtitle) => void
  onDeleteSubtitle: (id: number) => void
  currentTime: number
  onCreateSubtitleAtEnter: (id: number) => void
  onSplitSubtitle: (id: number, cursorPosition: number, text: string) => void
  onTypingStateChange?: (isTyping: boolean) => void
}

export default function SubtitleList({
  subtitles,
  activeSubtitle,
  onSelectSubtitle,
  onUpdateSubtitle,
  onDeleteSubtitle,
  currentTime,
  onCreateSubtitleAtEnter,
  onSplitSubtitle,
  onTypingStateChange,
}: SubtitleListProps) {
  const [editingTime, setEditingTime] = useState<{ id: number; type: "start" | "end" } | null>(null)
  const textareaRefs = useRef<{ [key: number]: HTMLTextAreaElement | null }>({})
  const [cursorPositions, setCursorPositions] = useState<{ [key: number]: number }>({})
  const typingTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    // Focus the active subtitle's textarea
    if (activeSubtitle && textareaRefs.current[activeSubtitle]) {
      textareaRefs.current[activeSubtitle]?.focus()
    }
  }, [activeSubtitle])

  const handleTextChange = (id: number, text: string) => {
    // Signal that typing has started
    if (onTypingStateChange) {
      onTypingStateChange(true)
    }

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
    }

    // Set a timeout to signal when typing has stopped
    typingTimeoutRef.current = window.setTimeout(() => {
      if (onTypingStateChange) {
        onTypingStateChange(false)
      }
      typingTimeoutRef.current = null
    }, 500)

    const subtitle = subtitles.find((s) => s.id === id)
    if (subtitle) {
      onUpdateSubtitle({ ...subtitle, text })
    }
  }

  const handleTimeChange = (id: number, type: "start" | "end", value: string) => {
    const subtitle = subtitles.find((s) => s.id === id)
    if (subtitle) {
      const timeInSeconds = parseTimeCode(value)
      if (type === "start") {
        onUpdateSubtitle({ ...subtitle, startTime: timeInSeconds })
      } else {
        onUpdateSubtitle({ ...subtitle, endTime: timeInSeconds })
      }
    }
  }

  const parseTimeCode = (timeCode: string): number => {
    const parts = timeCode.split(":")
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts
      const secondsParts = seconds.split(",")
      const secs = Number.parseFloat(`${secondsParts[0]}.${secondsParts[1] || "0"}`)
      return Number.parseInt(hours) * 3600 + Number.parseInt(minutes) * 60 + secs
    }
    return 0
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()

      const textarea = e.target as HTMLTextAreaElement
      const cursorPos = textarea.selectionStart
      const text = textarea.value

      // If cursor is at the beginning or end, create a new subtitle
      if (cursorPos === 0 || cursorPos === text.length) {
        onCreateSubtitleAtEnter(id)
      } else {
        // Otherwise split the subtitle at cursor position
        onSplitSubtitle(id, cursorPos, text)
      }
    }
  }

  const handleCursorPositionChange = (id: number, e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    setCursorPositions({
      ...cursorPositions,
      [id]: textarea.selectionStart,
    })
  }

  const getCPSColor = (cps: number) => {
    if (cps <= 15) return "text-green-600 bg-green-100"
    if (cps <= 20) return "text-yellow-600 bg-yellow-100"
    return "text-red-600 bg-red-100"
  }

  return (
    <div className="divide-y">
      {subtitles.map((subtitle) => (
        <div
          key={subtitle.id}
          className={`flex p-4 hover:bg-gray-50 ${activeSubtitle === subtitle.id ? "bg-blue-50" : ""}`}
          onClick={() => onSelectSubtitle(subtitle.id)}
        >
          <div className="w-16 flex-shrink-0">
            <div className="font-medium text-gray-700">{subtitle.id.toString().padStart(3, "0")}</div>
            <div className={`text-xs px-1 rounded mt-1 inline-block ${getCPSColor(subtitle.cps)}`}>
              {subtitle.cps} CPS
            </div>
          </div>

          <div className="w-28 flex-shrink-0 space-y-2">
            <div className="text-xs text-gray-500">CPL</div>

            <div
              className="border rounded px-2 py-1 text-xs cursor-pointer"
              onClick={() => setEditingTime({ id: subtitle.id, type: "start" })}
            >
              {editingTime && editingTime.id === subtitle.id && editingTime.type === "start" ? (
                <Input
                  value={formatTimeCode(subtitle.startTime)}
                  onChange={(e) => handleTimeChange(subtitle.id, "start", e.target.value)}
                  onBlur={() => setEditingTime(null)}
                  autoFocus
                  className="h-6 text-xs p-1"
                />
              ) : (
                formatTimeCode(subtitle.startTime).substring(3) // Skip hours for cleaner display
              )}
            </div>

            <div
              className="border rounded px-2 py-1 text-xs cursor-pointer"
              onClick={() => setEditingTime({ id: subtitle.id, type: "end" })}
            >
              {editingTime && editingTime.id === subtitle.id && editingTime.type === "end" ? (
                <Input
                  value={formatTimeCode(subtitle.endTime)}
                  onChange={(e) => handleTimeChange(subtitle.id, "end", e.target.value)}
                  onBlur={() => setEditingTime(null)}
                  autoFocus
                  className="h-6 text-xs p-1"
                />
              ) : (
                formatTimeCode(subtitle.endTime).substring(3) // Skip hours for cleaner display
              )}
            </div>
          </div>

          <div className="flex-1 relative">
            <Textarea
              ref={(el) => (textareaRefs.current[subtitle.id] = el)}
              value={subtitle.text}
              onChange={(e) => handleTextChange(subtitle.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, subtitle.id)}
              onSelect={(e) => handleCursorPositionChange(subtitle.id, e)}
              onClick={(e) => handleCursorPositionChange(subtitle.id, e)}
              placeholder="Enter subtitle text..."
              className="min-h-[80px] resize-none"
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSubtitle(subtitle.id)
              }}
              className="absolute top-2 right-2 h-6 w-6 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

