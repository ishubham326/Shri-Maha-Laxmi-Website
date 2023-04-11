/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById("nav-menu"),
  navToggle = document.getElementById("nav-toggle"),
  navClose = document.getElementById("nav-close");

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.add("show-menu");
  });
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if (navClose) {
  navClose.addEventListener("click", () => {
    navMenu.classList.remove("show-menu");
  });
}

const navLink = document.querySelectorAll(".nav-link");

function linkAction() {
  const navMenu = document.getElementById("nav-menu");
  // When we click on each nav__link, we remove the show-menu class
  navMenu.classList.remove("show-menu");
}
navLink.forEach((n) => n.addEventListener("click", linkAction));

/*=============== SHOW SCROLL UP ===============*/
function scrollUp() {
  const scrollUp = document.getElementById("scroll-up");
  // When the scroll is higher than 350 viewport height, add the show-scroll class to the a tag with the scroll-top class
  if (this.scrollY >= 350) scrollUp.classList.add("show-scroll");
  else scrollUp.classList.remove("show-scroll");
}
window.addEventListener("scroll", scrollUp);

const nav = document.getElementById("header");
let lastScrollY = window.scrollY;

window.addEventListener("scroll", () => {
  if (lastScrollY < window.scrollY) {
    nav.classList.add("animate");
  } else {
    nav.classList.remove("animate");
  }

  lastScrollY = window.scrollY;
});

const sr = ScrollReveal({
  origin: "top",
  distance: "60px",
  duration: 1300,
  delay: 70,
  //reset: true
});
sr.reveal(".title");
sr.reveal(".mandela");
sr.reveal(".covid-content");
sr.reveal(".card", { delay: 200 });
sr.reveal(".calendar");
sr.reveal(".dates-rec");
sr.reveal(".laxmi");
sr.reveal(".about-title-text", { delay: 200 });
sr.reveal(".pandit");
sr.reveal(".priest-text", { delay: 200 });
sr.reveal(".service-content", { delay: 200 });
sr.reveal(".connect-right-content");
sr.reveal(".social", { delay: 100 });
sr.reveal(".cal-download-buttons");
// sr.reveal(".month-rec");
sr.reveal(".booking-items");

/*=============== SEARCH BAR ===============*/

function search() {
  var input, filter, li, date, i, txtValue;
  input = document.getElementById("searchInput");
  filter = input.value.toUpperCase().trim();
  li = document.getElementsByTagName("p");

  // console.log(li);
  for (i = 0; i < li.length; i++) {
    date = li[i];
    txtValue = date.textContent || date.innerText;
    if (txtValue.toUpperCase().indexOf(filter) > -1) {
      li[i].style.display = "";
    } else {
      li[i].style.display = "none";
    }
  }
}

/*=============== SUNDAY KIRTAN ===============*/
let autoDate = false;
const eventDate = document.getElementById("eventDate");

if (autoDate) {
  var sundayDate = new Date();
  // console.log((7 - sundayDate.getDay()) % 7);
  var months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (sundayDate.getDay() % 6 === 0) {
    console.log(
      "Wanna help out with this site? Feel free to start a PR on https://github.com/ishubham326/Shri-Maha-Laxmi-Website"
    );
    eventDate.innerHTML = `${
      months[sundayDate.getMonth()]
    } ${sundayDate.getUTCDate()}`;
  } else {
    sundayDate.setDate(
      sundayDate.getDate() + ((7 - sundayDate.getDay()) % 7 || 7)
    );
    eventDate.innerHTML = `${
      months[sundayDate.getMonth()]
    } ${sundayDate.getDate()}`;
  }
}
// Card Image

const cardImage = document.getElementById("cardImage");
var today = new Date().toLocaleString("en-us", { weekday: "long" });

if (cardImage) {
  switch (today.toLowerCase()) {
    case "monday":
      cardImage.style.backgroundImage = 'url("/Desktop/events/shiv2.webp")';
      break;
    case "tuesday":
      cardImage.style.backgroundImage = 'url("/Desktop/events/hanuman2.jpg")';
      break;
    case "wednesday":
    case "thursday":
    case "friday":
      cardImage.style.backgroundImage = 'url("/Desktop/events/laxmi.jpg")';
      break;
    default:
      cardImage.style.backgroundImage = 'url("/Desktop/events/sunday.png")';
  }
}

// Image Gallery
const imageGallery = document.getElementById("imageGallery");
let imgs = [
  "radhaKrishn.jpg",
  "laxmi.jpg",
  "shivParvati.jpg",
  "ganesh.jpg",
  "shivling.jpg",
  "hanuman.jpg",
  "durga.jpg",
  "kargan.jpg",
  "laxmiNarayan.jpg",
  "gopal.jpg",
  "narayanlaxmi.jpg",
  "nav.jpg",
  "shani.jpg",
  "ramDarbar.jpg",
  "sai.jpg",
  "saraswati.jpg",
  "shiv2.jpg",
  "surya.jpg",
  "balak.jpg",
  "left1.jpg",
  "right1.jpg",
  "left.jpg",
  "right.jpg",
];
if (imageGallery) {
  for (i = 0; i < imgs.length; i++) {
    imageGallery.innerHTML +=
      "<img src='/Desktop/murtis/" +
      imgs[i] +
      "' class='images' loading='lazy' />";
  }
}
