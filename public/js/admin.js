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

  const searchInput = document.getElementById("search-input");

  // Listen for "Enter" key press in the search input field
  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      // Prevent the default form submission behavior
      event.preventDefault();
      // Trigger the search function
      searchUsers();
    }
  });

  // Add event listeners to search and reset buttons
  const searchButton = document.querySelector(".btn-primary");
  const resetButton = document.querySelector(".btn-secondary");

  searchButton.addEventListener("click", searchUsers);
  resetButton.addEventListener("click", resetSearch);

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
