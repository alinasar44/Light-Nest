import {
  Baby,
  Bath,
  BedDouble,
  BookOpen,
  Briefcase,
  Car,
  CookingPot,
  Dumbbell,
  Gamepad2,
  House,
  Lamp,
  Sofa,
  Trees,
  Tv,
  Utensils,
  WashingMachine,
} from 'lucide-react'

export const ROOM_ICONS = {
  sofa: Sofa,
  bed: BedDouble,
  kitchen: CookingPot,
  dining: Utensils,
  bath: Bath,
  kids: Baby,
  office: Briefcase,
  study: BookOpen,
  tv: Tv,
  games: Gamepad2,
  gym: Dumbbell,
  laundry: WashingMachine,
  garage: Car,
  garden: Trees,
  lamp: Lamp,
  house: House,
}

export function roomIcon(key) {
  return ROOM_ICONS[key] || House
}

export function newId(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Turns "Guest Room" into "guestroom" for suggested topics like home/guestroom/light1.
export function topicSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'room'
}

const OFF_WORDS = ['0', 'off', 'false']

export function isOn(payload, sw) {
  if (payload == null) return false
  const value = String(payload).trim().toLowerCase()
  const onValue = String(sw.on || 'ON').trim().toLowerCase()
  if (value === onValue) return true
  return ['1', 'on', 'true'].includes(value) && !OFF_WORDS.includes(onValue)
}

// Topics a switch listens on: its state topic (what the device reports) and its command topic.
export function switchTopics(sw) {
  return [sw.stateTopic, sw.topic].filter(Boolean)
}

// Current payload for a switch: the device's reported state wins, the last (retained) command is the fallback.
export function switchPayload(payloads, sw) {
  const state = sw.stateTopic ? payloads[sw.stateTopic] : null
  return state ?? payloads[sw.topic] ?? null
}

export function lightCountLabel(n) {
  const words = ['No lights', 'One light', 'Two lights', 'Three lights', 'Four lights', 'Five lights']
  return words[n] || `${n} lights`
}
