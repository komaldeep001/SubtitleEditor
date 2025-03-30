import type { Subtitle } from "@/types/subtitle"

export function parseSRT(srtContent: string): Subtitle[] {
  const subtitles: Subtitle[] = []
  const blocks = srtContent.trim().split(/\r?\n\r?\n/)

  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/)
    if (lines.length < 3) return

    const id = Number.parseInt(lines[0])
    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/)

    if (!timeMatch) return

    const startTime =
      Number.parseInt(timeMatch[1]) * 3600 +
      Number.parseInt(timeMatch[2]) * 60 +
      Number.parseInt(timeMatch[3]) +
      Number.parseInt(timeMatch[4]) / 1000

    const endTime =
      Number.parseInt(timeMatch[5]) * 3600 +
      Number.parseInt(timeMatch[6]) * 60 +
      Number.parseInt(timeMatch[7]) +
      Number.parseInt(timeMatch[8]) / 1000

    const text = lines.slice(2).join("\n")

    // Calculate CPS
    const duration = endTime - startTime
    const charCount = text.replace(/\s/g, "").length
    const cps = duration > 0 ? Math.round((charCount / duration) * 10) / 10 : 0

    subtitles.push({
      id,
      startTime,
      endTime,
      text,
      cps,
    })
  })

  return subtitles
}

export function generateSRT(subtitles: Subtitle[]): string {
  return subtitles
    .sort((a, b) => a.startTime - b.startTime)
    .map((subtitle, index) => {
      const number = index + 1
      const timeCode = `${formatSRTTime(subtitle.startTime)} --> ${formatSRTTime(subtitle.endTime)}`
      return `${number}\n${timeCode}\n${subtitle.text}\n`
    })
    .join("\n")
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`
}

