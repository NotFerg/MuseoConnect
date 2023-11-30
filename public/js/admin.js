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
  document.getElementById('search-input').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        searchUsers();
    }
});

  // Add event listeners to search and reset buttons
  const searchButton = document.getElementById("searchBtn")
  const resetButton = document.getElementById("resetBtn")

  searchButton.addEventListener("click", searchUsers);
  resetButton.addEventListener("click", resetSearch);

  //Table functionaility
  function searchUsersTable() {
    const searchInputTable = document.getElementById("search-input-table");
    const searchTermTable = searchInputTable.value.trim().toLowerCase();
    const rows = document.querySelectorAll("#user-table tbody tr");

    rows.forEach((row) => {
      const name = row.cells[0].textContent.trim().toLowerCase();
      const email = row.cells[1].textContent.trim().toLowerCase();

      if (name.includes(searchTermTable) || email.includes(searchTermTable)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  }

  function resetSearchTable() {
    const rows = document.querySelectorAll("#user-table tbody tr");
    rows.forEach((row) => {
      row.style.display = "";
    });
    document.getElementById("search-input-table").value = "";
  }

  const searchInputTable = document.getElementById("search-input-table");

  // Listen for "Enter" key press in the search input field
  document.getElementById('search-input-table').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        searchUsersTable();
    }
});

 // Add event listeners to search and reset buttons for the table
const searchButtonTable = document.getElementById("searchTableBtn")
const resetButtonTable = document.getElementById("resetTableBtn")

searchButtonTable.addEventListener("click", searchUsersTable); // Corrected function name
resetButtonTable.addEventListener("click", resetSearchTable);

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
