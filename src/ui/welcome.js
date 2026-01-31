/**
 * Welcome Tour Logic
 * Handles slide navigation and "Finish" action.
 */

document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    const steps = document.querySelectorAll('.step');
    const nextBtns = document.querySelectorAll('.btn-next');
    const finishBtn = document.getElementById('finishTour');

    let currentSlide = 0;

    // Next Button Handlers
    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            goToSlide(currentSlide + 1);
        });
    });

    // Finish Button Handler
    if (finishBtn) {
        finishBtn.addEventListener('click', () => {
            // Close this tab and open popup (or just close if user opened it manually, but for install flow we want to show extension)
            // Actually, standard pattern is to close this tab and let user invoke extension, 
            // OR redirect to an "instruction" page.
            // We'll redirect to the popup HTML as a full page for now so they see the dashboard.
            // Redirect to the main dashboard
            window.location.href = chrome.runtime.getURL('html/popup.html');
        });
    }

    function goToSlide(index) {
        if (index < 0 || index >= slides.length) return;

        // Update Slides
        slides[currentSlide].classList.remove('active');
        slides[index].classList.add('active');

        // Update Steps
        steps[currentSlide].classList.remove('active');
        steps[currentSlide].classList.add('completed');

        steps[index].classList.add('active');

        currentSlide = index;
    }
});
