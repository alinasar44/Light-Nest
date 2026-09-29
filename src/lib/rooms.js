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

// Devices answer on the matching status topic: prefix/control/relay1 -> prefix/status/relay1.
export function deriveStateTopic(topic) {
  const t = (topic || '').trim()
  return t.includes('/control/') ? t.replace('/control/', '/status/') : ''
}

// State topic of a switch: the one set by hand, otherwise the one derived from its command topic.
export function stateTopicOf(sw) {
  return (sw.stateTopic || '').trim() || deriveStateTopic(sw.topic)
}

// Topics a switch listens on: its state topic (what the device reports) and its command topic.
export function switchTopics(sw) {
  return [stateTopicOf(sw), sw.topic].filter(Boolean)
}

// Current payload for a switch: whichever of the device's state and the last command is newest.
// A command sent from here shows right away, so the next tap sends the opposite even when the device's
// reported state was stale; the device's answer then replaces it. On ties (retained / cached) the device wins.
export function switchPayload(payloads, sw) {
  const stateTopic = stateTopicOf(sw)
  const state = stateTopic ? payloads[stateTopic] : null
  const command = payloads[sw.topic]
  if (state?.value == null) return command?.value ?? null
  if (command?.value == null) return state.value
  return command.at > state.at ? command.value : state.value
}

export function lightCountLabel(n) {
  const words = ['No lights', 'One light', 'Two lights', 'Three lights', 'Four lights', 'Five lights']
  return words[n] || `${n} lights`
}
