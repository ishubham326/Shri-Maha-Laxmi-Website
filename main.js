/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById('nav-menu'),
      navToggle = document.getElementById('nav-toggle'),
      navClose = document.getElementById('nav-close');

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if(navToggle){
    navToggle.addEventListener('click', () =>{
        navMenu.classList.add('show-menu');
    })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if(navClose){
    navClose.addEventListener('click', () =>{
        navMenu.classList.remove('show-menu');
    })
}

const navLink = document.querySelectorAll('.nav-link');

function linkAction(){
    const navMenu = document.getElementById('nav-menu');
    // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove('show-menu');
}
navLink.forEach(n => n.addEventListener('click', linkAction));

/*=============== SHOW SCROLL UP ===============*/ 
function scrollUp(){
    const scrollUp = document.getElementById('scroll-up');
    // When the scroll is higher than 350 viewport height, add the show-scroll class to the a tag with the scroll-top class
    if(this.scrollY >= 350) scrollUp.classList.add('show-scroll'); else scrollUp.classList.remove('show-scroll');
  }
  window.addEventListener('scroll', scrollUp);

const nav = document.getElementById('header');
let lastScrollY = window.scrollY;
window.addEventListener("scroll", ()=>{
    if(lastScrollY < window.scrollY){
        nav.classList.add('animate');
    }
    else{
        nav.classList.remove('animate');
    }

    lastScrollY = window.scrollY;
});


const sr = ScrollReveal({
      origin: 'top',
      distance: '60px',
      duration: 1500,
      delay: 100,
      //reset: true
  });
sr.reveal('.title');
sr.reveal('.mandela');
sr.reveal('.covid-content');
sr.reveal('.card', {delay: 500});
sr.reveal('.calendar');
sr.reveal('.dates-rec');
sr.reveal('.laxmi');
sr.reveal('.about-title-text', {delay: 500});
sr.reveal('.pandit');
sr.reveal('.priest-text', {delay: 500});
sr.reveal('.connect-right-content');
sr.reveal('.social', {delay: 500});
sr.reveal('.cal-download-buttons');
sr.reveal('.month-rec');
