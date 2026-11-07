function formatEventLine(date, event, important) {
  const eventStr = important ? `<strong>${event}</strong>` : event;
  const dateStr = String(date).padStart(2, "0");
  const dots = ".".repeat(Math.max(0, 32 - 2 - event.length));
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

// Load the event data for the year shown on this calendar page
const calendarYear = document
  .querySelector(".cal-download-buttons h6")
  ?.textContent.trim();

if (calendarYear) {
  fetch(`${calendarYear}-events.json`)
    .then((res) => res.json())
    .then((data) => {
      renderCalendar(data);
    });
}
