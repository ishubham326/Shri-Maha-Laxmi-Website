// Helper function to pad event lines to 29 chars
function formatEventLine(date, event, important) {
  const dateStr = String(date).padStart(2, "0");
  let eventStr = important ? `<strong>${event}</strong>` : event;
  // Remove HTML tags for dot calculation
  const plainEvent = event;
  // If eventStr contains <strong>, don't count those tags in length
  const eventLen = event.length;
  const dots = ".".repeat(29 - 2 - eventLen);
  return `<p>${dateStr}${dots}${eventStr}</p>`;
}

// Render months in groups of 4 per section
function renderCalendar(events) {
  const months = Object.keys(events);
  const container = document.getElementById("calendar-container");
  if (!container) return;
  for (let i = 0; i < months.length; i += 4) {
    let section = document.createElement("section");
    section.className = "months";
    for (let j = i; j < i + 4 && j < months.length; j++) {
      const month = months[j];
      const monthDiv = document.createElement("div");
      monthDiv.className = "month-rec";
      monthDiv.innerHTML = `<h2>${month}</h2><div class="dates"></div>`;
      const datesDiv = monthDiv.querySelector(".dates");
      events[month].forEach((ev) => {
        datesDiv.innerHTML += formatEventLine(ev.date, ev.event, ev.important);
      });
      section.appendChild(monthDiv);
    }
    container.appendChild(section);
  }
}

// Load JSON and render
fetch("2026-events.json")
  .then((res) => res.json())
  .then((data) => {
    renderCalendar(data);
  });
