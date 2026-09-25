// ===============================================================
//  NABVISIONS SITE SETTINGS
//  Edit this file to change contact details, clips and results.
//  No rebuild needed: just save and redeploy.
// ===============================================================
window.NABVISIONS = {
  // Where enquiries go
  email: "hello@nabvisions.com",

  // WhatsApp number in international format, digits only (e.g. "923001234567"). Leave "" to hide.
  whatsapp: "",

  // Booking link (Calendly, Cal.com...). When set, every "Book a call" button opens it.
  booking: "",

  // Free form backend from formspree.io, e.g. "https://formspree.io/f/abcdwxyz".
  // Leave "" and the form opens the visitor's email app instead.
  formEndpoint: "",

  // Your own video clips, shown on the 3D screens.
  // Order: [left phone, big screen, right phone]. Vertical (9:16) clips for phones,
  // horizontal (16:9) for the big screen. Short, muted, compressed MP4s (< 3 MB each).
  // Example: ["assets/clips/short-1.mp4", "assets/clips/longform.mp4", "assets/clips/short-2.mp4"]
  clips: [],

  // Real client results only: channels you worked on, numbers you can prove,
  // shared with the client's permission.
  // { name: "Channel", platform: "YouTube", niche: "History explainers",
  //   link: "https://youtube.com/@channel",
  //   stats: [{ value: "1.2M", label: "views in 90 days" }] }
  portfolio: [],

  // Nabvisions' own social profiles. Leave "" to hide.
  socials: { tiktok: "", youtube: "", instagram: "" },
};
