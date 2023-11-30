document.addEventListener("DOMContentLoaded", function () {
    //RESERVATION SEARCH AND CLEAR FUNCTION
    function searchReservations() {
       const searchInput = document.getElementById("reservation-search-input");
       const dateInput = document.getElementById("reservation-date-input");
       const searchTerm = searchInput.value.trim().toLowerCase();
       const dateTerm = dateInput.value.trim(); // No need to convert to lowercase for dates
       const cards = document.querySelectorAll(".reservation-card");
   
       cards.forEach((card) => {
           const name = card.querySelector(".card-title").textContent.trim().toLowerCase();
           const email = card.querySelector(".card-text").textContent.trim().toLowerCase();
           const date = card.querySelector(".visitDate").value; // Assuming the date is stored in an input field with class 'visitDate'
   
           if (
               (name.includes(searchTerm) || email.includes(searchTerm)) &&
               (dateTerm === "" || date.includes(dateTerm))
           ) {
               card.style.display = "block";
           } else {
               card.style.display = "none";
           }
       });
   }
   
   function resetReservationSearch() {
       const cards = document.querySelectorAll(".reservation-card");
       cards.forEach((card) => {
           card.style.display = "block";
       });
       document.getElementById("reservation-search-input").value = "";
   }

   // Add event listeners to search and reset buttons for reservations
   const reservationSearchButton = document.querySelector(
       "#reservation-search-button"
   );
   const reservationResetButton = document.querySelector(
       "#reservation-reset-button"
   );

   reservationSearchButton.addEventListener("click", searchReservations);
   reservationResetButton.addEventListener("click", resetReservationSearch);

   $(function () {
       $(".visitDate").datepicker({
           minDate: 0, // Disable past dates
           dateFormat: 'yy-mm-dd', // Set the date format as per your needs
       });
   });

   const searchInputReserv = document.getElementById("reservation-search-input");
    const dateInputReserv = document.getElementById("reservation-date-input");

    document.getElementById('reservation-search-input').addEventListener('keydown', function (event) {
       if (event.key === 'Enter') {
           event.preventDefault();
           searchReservations();
       }
   });

   let inactivityTimeout;
   // Function to reset the inactivity timer
   function resetInactivityTimeout() {
       clearTimeout(inactivityTimeout);
       inactivityTimeout = setTimeout(() => {
           // Send a request to the server to reset the session timeout
           fetch("/reset-inactivity").then((response) => {
               if (response.ok) {
                   console.log("Inactivity timer reset.");
                   // Redirect to the logout route after 1 minute of inactivity
                   window.location.href = "/logout";
               }
           });
       }, 300000); // 300,000 milliseconds = 5 minutes
   }
   // Listen for user interactions
   window.addEventListener("mousemove", resetInactivityTimeout);
   window.addEventListener("keydown", resetInactivityTimeout);
   // Initial reset
   resetInactivityTimeout();

});

$(function () {
   $(".update-visit-time").on('click', function () {
       const newVisitTime = $(this).data('new-time');
       const form = $(this).closest('.update-visit-time-form');

       // Add console.log statements for debugging
       console.log('Updating visit time to:', newVisitTime);
       console.log('Form data before update:', form.serialize());

       // Update the hidden input value before submitting the form
       form.find('input[name="visitTime"]').val(newVisitTime);

       // Add another console.log statement to check the form data after the update
       console.log('Form data after update:', form.serialize());

       // Submit the form
       form.submit();
   });
});