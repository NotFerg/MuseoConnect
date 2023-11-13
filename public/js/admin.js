document.addEventListener("DOMContentLoaded", function () {
  function searchUsers() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".card");

    cards.forEach((card) => {
      const name = card
        .querySelector(".card-title")
        .textContent.trim()
        .toLowerCase();
      const email = card
        .querySelector(".card-text")
        .textContent.trim()
        .toLowerCase();
      if (name.includes(searchTerm) || email.includes(searchTerm)) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  }

  function resetSearch() {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card) => {
      card.style.display = "block";
    });
    document.getElementById("search-input").value = "";
  }

  // Add event listeners to search and reset buttons
  const searchButton = document.querySelector(".btn-primary");
  const resetButton = document.querySelector(".btn-secondary");

  searchButton.addEventListener("click", searchUsers);
  resetButton.addEventListener("click", resetSearch);

  //RESERVATION SEARCH AND CLEAR FUNCTION
  function searchReservations() {
    const searchInput = document.getElementById("reservation-search-input");
    const searchTerm = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".reservation-card");

    cards.forEach((card) => {
      const name = card
        .querySelector(".card-title")
        .textContent.trim()
        .toLowerCase();
      const email = card
        .querySelector(".card-text")
        .textContent.trim()
        .toLowerCase();
      if (name.includes(searchTerm) || email.includes(searchTerm)) {
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
