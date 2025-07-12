document.addEventListener('DOMContentLoaded', () => {
    // --- CACHE DOM ELEMENTS ---
    const bookingForm = document.getElementById('booking-form');
    if (!bookingForm) {
        // If the form is not on this page, do nothing.
        return;
    }
    const serviceTypeElement = document.getElementById('service-type');
    const dateSelectionElement = document.getElementById('date-selection');
    const timeSelectionElement = document.getElementById('time-selection');
    const statusMessageElement = document.getElementById('status-message');
    const submitButton = bookingForm.querySelector('button[type="submit"]');

    // --- SERVICE DURATION CONFIGURATION ---
    const serviceDurations = {
        'Interior': 4, // 4 hours
        'Bedliner': 8, // 8 hours (full day)
        'Body': 8,     // 8 hours (full day)
    };

    // --- INITIALIZE FLATPICKR DATE PICKER ---
    const fp = flatpickr(dateSelectionElement, {
        minDate: 'today',
        dateFormat: "Y-m-d",
        "disableMobile": true,
        // Trigger availability check when the date changes
        onChange: () => debouncedCheckAvailability(),
    });

    /**
     * Utility to limit how often a function is executed.
     * This prevents sending too many requests to the server while the user is interacting with the form.
     * @param {Function} func The function to debounce.
     * @param {number} delay The delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };

    /**
     * Checks the Google Calendar in real-time to see if the selected slot is available.
     */
    const checkAvailability = async () => {
        const service = serviceTypeElement.value;
        const selectedDate = dateSelectionElement.value;
        const selectedTime = timeSelectionElement.value;

        // Don't run the check if the form is incomplete
        if (!service || !selectedDate || !selectedTime) {
            statusMessageElement.textContent = '';
            statusMessageElement.className = 'message';
            submitButton.disabled = false; // Keep button enabled until a conflict is confirmed
            return;
        }

        // Provide immediate feedback to the user that we are checking
        statusMessageElement.textContent = 'Checking availability...';
        statusMessageElement.className = 'message';
        submitButton.disabled = true; // Disable button during check

        // Construct the start and end times for the potential booking
        const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
        const serviceDuration = serviceDurations[service];
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + serviceDuration);

        try {
            // Fetch all events for the selected day from the server
            const response = await fetch(`/.netlify/functions/server/get-events?date=${startTime.toISOString()}`);
            if (!response.ok) {
                throw new Error('Failed to fetch calendar data from the server.');
            }
            
            const events = await response.json();

            // Check if any existing event overlaps with the requested time slot
            const isConflict = events.some(event => {
                const eventStart = new Date(event.start.dateTime);
                const eventEnd = new Date(event.end.dateTime);
                // The logic for an overlap is: (StartA < EndB) and (EndA > StartB)
                return startTime < eventEnd && endTime > eventStart;
            });

            // Update the UI based on whether a conflict was found
            if (isConflict) {
                statusMessageElement.textContent = 'This time slot is already booked. Please choose another time or date.';
                statusMessageElement.className = 'message error';
                submitButton.disabled = true; // Keep button disabled
            } else {
                statusMessageElement.textContent = 'This time slot is available!';
                statusMessageElement.className = 'message success';
                submitButton.disabled = false; // Re-enable the button
            }
        } catch (error) {
            console.error('Availability check error:', error);
            statusMessageElement.textContent = 'Could not verify availability. Please try again.';
            statusMessageElement.className = 'message error';
            // Allow user to try submitting anyway in case of a temporary network issue
            submitButton.disabled = false;
        }
    };

    // Create a debounced version of the check function to avoid excessive API calls
    const debouncedCheckAvailability = debounce(checkAvailability, 500);

    // --- ATTACH EVENT LISTENERS ---
    // Check availability when the service or time selection changes
    serviceTypeElement.addEventListener('change', debouncedCheckAvailability);
    timeSelectionElement.addEventListener('change', debouncedCheckAvailability);

    // --- FORM SUBMISSION EVENT LISTENER ---
    bookingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Final validation before submitting
        const service = serviceTypeElement.value;
        const selectedDate = dateSelectionElement.value;
        const selectedTime = timeSelectionElement.value;

        if (!service || !selectedDate || !selectedTime) {
            statusMessageElement.textContent = 'Please ensure all fields are selected.';
            statusMessageElement.className = 'message error';
            return;
        }

        const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
        const serviceDuration = serviceDurations[service];
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + serviceDuration);

        // Show submitting status
        statusMessageElement.textContent = 'Submitting your booking...';
        statusMessageElement.className = 'message';
        submitButton.disabled = true;

        try {
            const response = await fetch('/.netlify/functions/server/create-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: service,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                }),
            });

            const data = await response.json();

            if (response.ok) {
                statusMessageElement.textContent = 'Booking request successful! We will contact you shortly to confirm.';
                statusMessageElement.className = 'message success';
                bookingForm.reset();
                fp.clear();
            } else {
                statusMessageElement.textContent = `Error: ${data.message}`;
                statusMessageElement.className = 'message error';
                if (data.conflict) {
                    sendConflictEmail(data.conflict);
                }
            }
        } catch (error) {
            console.error('Booking submission error:', error);
            statusMessageElement.textContent = 'A network error occurred. Please try again later.';
            statusMessageElement.className = 'message error';
        } finally {
            // Re-enable button after submission attempt unless successful
            if (statusMessageElement.className.includes('error')) {
                submitButton.disabled = false;
            }
        }
    });

    /**
     * Sends an email notification about a booking conflict (optional).
     * @param {object} conflictDetails - The details of the conflict from the server.
     */
    async function sendConflictEmail(conflictDetails) {
        try {
            await fetch('/.netlify/functions/server/send-conflict-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(conflictDetails),
            });
        } catch (error) {
            console.error('Failed to send conflict email:', error);
        }
    }
});
