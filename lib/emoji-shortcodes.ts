/**
 * Standard `:shortcode:` -> Unicode emoji mapping (the same names Discord's
 * own client auto-converts as you type in its chat box). That conversion
 * only happens client-side in Discord's UI though -- text typed into this
 * site's forms, or sent by the bot API, never gets it, so `:crescent_moon:`
 * would otherwise show up as literal text both on the site and in the
 * eventual Discord post. This is a hand-picked common subset, not the full
 * ~1800-entry gemoji set -- add more here as people hit missing ones.
 */
const SHORTCODE_TO_EMOJI: Record<string, string> = {
  // Smileys & people
  smile: "😄", grin: "😁", joy: "😂", laughing: "😆", wink: "😉", blush: "😊",
  slight_smile: "🙂", upside_down: "🙃", relieved: "😌", heart_eyes: "😍",
  thinking: "🤔", neutral_face: "😐", confused: "😕", worried: "😟", cry: "😢",
  sob: "😭", angry: "😠", rage: "😡", triumph: "😤", sleepy: "😪", sleeping: "😴",
  scream: "😱", cold_sweat: "😰", sweat_smile: "😅", tired_face: "😫",
  weary: "😩", flushed: "😳", sunglasses: "😎", nerd: "🤓", clown: "🤡",
  skull: "💀", ghost: "👻", alien: "👽", robot: "🤖", poop: "💩",
  clap: "👏", wave: "👋", thumbsup: "👍", "+1": "👍", thumbsdown: "👎", "-1": "👎",
  pray: "🙏", muscle: "💪", ok_hand: "👌", point_right: "👉", point_left: "👈",
  point_up: "👆", point_down: "👇", raised_hands: "🙌", handshake: "🤝",
  crossed_fingers: "🤞", eyes: "👀", brain: "🧠",

  // Hearts
  heart: "❤️", orange_heart: "🧡", yellow_heart: "💛", green_heart: "💚",
  blue_heart: "💙", purple_heart: "💜", black_heart: "🖤", white_heart: "🤍",
  broken_heart: "💔", sparkling_heart: "💖", heartbeat: "💓", two_hearts: "💕",

  // Nature / weather
  sun: "☀️", sunny: "☀️", crescent_moon: "🌙", full_moon: "🌕", new_moon: "🌑",
  moon: "🌙", star: "⭐", star2: "🌟", sparkles: "✨", zap: "⚡", fire: "🔥",
  cloud: "☁️", rainbow: "🌈", snowflake: "❄️", droplet: "💧", ocean: "🌊",
  earth_americas: "🌎", earth_africa: "🌍", earth_asia: "🌏", globe: "🌐",
  leaves: "🍃", herb: "🌿", four_leaf_clover: "🍀", rose: "🌹", cherry_blossom: "🌸",

  // Objects & symbols
  tada: "🎉", confetti_ball: "🎊", gift: "🎁", trophy: "🏆", medal: "🎖️",
  first_place: "🥇", second_place: "🥈", third_place: "🥉", crown: "👑",
  gem: "💎", moneybag: "💰", money_with_wings: "💸", coin: "🪙",
  ballot_box: "🗳️", bell: "🔔", no_bell: "🔕", loudspeaker: "📢", mega: "📣",
  bulb: "💡", lock: "🔒", unlock: "🔓", key: "🔑", warning: "⚠️", rotating_light: "🚨",
  checkered_flag: "🏁", triangular_flag_on_post: "🚩", pushpin: "📌", round_pushpin: "📍",
  calendar: "📅", date: "📅", clock: "🕐", alarm_clock: "⏰", hourglass: "⌛",
  scroll: "📜", memo: "📝", book: "📖", books: "📚", newspaper: "📰",
  chart_with_upwards_trend: "📈", chart_with_downwards_trend: "📉", bar_chart: "📊",
  white_check_mark: "✅", heavy_check_mark: "✔️", x: "❌", negative_squared_cross_mark: "❎",
  question: "❓", exclamation: "❗", bangbang: "‼️", interrobang: "⁉️",
  100: "💯", recycle: "♻️", infinity: "♾️",

  // Combat / gaming (relevant to an OSRS clan)
  crossed_swords: "⚔️", dagger: "🗡️", shield: "🛡️", bow_and_arrow: "🏹",
  gun: "🔫", boom: "💥", collision: "💥", dizzy: "💫", anger: "💢",
  skull_and_crossbones: "☠️", game_die: "🎲", joystick: "🕹️", video_game: "🎮",
  dart: "🎯", performing_arts: "🎭", tent: "⛺", camping: "🏕️", world_map: "🗺️",
  castle: "🏰", european_castle: "🏰",

  // Food & drink
  beer: "🍺", beers: "🍻", cocktail: "🍸", tropical_drink: "🍹", coffee: "☕",
  pizza: "🍕", hamburger: "🍔", fries: "🍟", cake: "🎂", birthday: "🎂",
  cookie: "🍪", candy: "🍬",

  // Animals
  dog: "🐶", cat: "🐱", mouse: "🐭", rabbit: "🐰", fox: "🦊", bear: "🐻",
  panda: "🐼", frog: "🐸", monkey: "🐵", chicken: "🐔", penguin: "🐧",
  owl: "🦉", dragon: "🐉", unicorn: "🦄", snake: "🐍", spider: "🕷️",
};

/**
 * Replaces `:shortcode:` tokens with their real Unicode character wherever
 * a match exists; unmatched tokens (custom Discord emote names, or plain
 * text that happens to contain colons) are left untouched.
 */
export function resolveUnicodeShortcodes(text: string): string {
  if (!/:[a-zA-Z0-9_+-]+:/.test(text)) return text;
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, name) => SHORTCODE_TO_EMOJI[name] ?? match);
}
