$(function () {
    // Set up datepicker for each date input
    $(".datePicker").datepicker({
        minDate: 0, // Disable past dates
        dateFormat: 'yy-mm-dd', // Set the date format as per your needs
    });
});

//FOR BLOCKED DATES
const btnSubmitDate = document.getElementById("btnsubmitDate");

btnSubmitDate.addEventListener("click", () => {
    // const datetimeInput = document.getElementById("blockedDate");
    const checkbox1030 = document.getElementById("checkbox1030");
    const checkbox1330 = document.getElementById("checkbox1330");
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    // const blockedDate = datetimeInput.value;
    const blockedTimes = [];

    if (checkbox1030.checked) {
        blockedTimes.push("10:30");
    }
    if (checkbox1330.checked) {
        blockedTimes.push("13:30");
    }

    const data = {
        startDate: startDate,
        endDate: endDate,
        blockedTimes: blockedTimes,
      };

    // Make sure data is being constructed correctly
    console.log("Data to be sent:", data);

    const url = `/loggedIn/admin/addBlockedDates`;

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Response from server:", data);
        if (data.success) {
            setTimeout(() => {
                window.location.href = "/loggedInadminblocked";
            }, 2000); // delay in milliseconds
        } else {
            console.error("Server responded with an error:", data.message);
        }
    })
    .catch(error => console.error("Error:", error));
});
