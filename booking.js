document.addEventListener('DOMContentLoaded', () => {
    // --- CACHE DOM ELEMENTS ---
    const bookingForm = document.getElementById('booking-form');
    if (!bookingForm) {
        return;
    }
    const serviceTypeElement = document.getElementById('service-type');
    const dateSelectionElement = document.getElementById('date-selection');
    const timeSelectionElement = document.getElementById('time-selection');
    const statusMessageElement = document.getElementById('status-message');
    const availabilityStatusElement = document.getElementById('availability-status');
    const submitButton = bookingForm.querySelector('button[type="submit"]');

    // --- SUCCESS MODAL ELEMENTS ---
    const successModalOverlay = document.getElementById('success-modal-overlay');
    const closeSuccessModalBtn = document.getElementById('close-success-modal');
    const newBookingBtn = document.getElementById('new-booking-button');
    const summaryService = document.getElementById('summary-service');
    const summaryDate = document.getElementById('summary-date');
    const summaryTime = document.getElementById('summary-time');

    // --- SERVICE DURATION CONFIGURATION ---
    const serviceDurations = {
        'Interior': 4,
        'Bedliner': 8,
        'Body': 8,
    };

    // --- INITIALIZE FLATPICKR DATE PICKER ---
    const fp = flatpickr(dateSelectionElement, {
        minDate: 'today',
        dateFormat: "Y-m-d",
        "disableMobile": true,
        "disable": [
            function(date) {
                return (date.getDay() === 0);
            }
        ],
        onChange: () => debouncedCheckAvailability(),
    });

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };

    const checkAvailability = async () => {
        availabilityStatusElement.textContent = '';
        availabilityStatusElement.className = 'availability-status';
        statusMessageElement.textContent = '';
        statusMessageElement.className = 'message';

        const service = serviceTypeElement.value;
        const selectedDateStr = dateSelectionElement.value;
        const selectedTime = timeSelectionElement.value;
        
        if (selectedDateStr) {
            const selectedDate = new Date(selectedDateStr + 'T00:00:00');
            const day = selectedDate.getDay();

            if (day === 0) {
                statusMessageElement.textContent = 'For Sunday availability, please call or text 250-580-5207.';
                statusMessageElement.className = 'message error';
                submitButton.disabled = true;
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate.getTime() === today.getTime()) {
                statusMessageElement.textContent = 'Please call or text 250-580-5207 for same-day bookings.';
                statusMessageElement.className = 'message error';
                submitButton.disabled = true;
                return;
            }
        }

        if (!service || !selectedDateStr || !selectedTime) {
            submitButton.disabled = false;
            return;
        }

        availabilityStatusElement.textContent = 'Checking...';
        submitButton.disabled = true;

        const startTime = new Date(`${selectedDateStr}T${selectedTime}:00`);
        const serviceDuration = serviceDurations[service];
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + serviceDuration);

        try {
            const response = await fetch(`/.netlify/functions/server/get-events?date=${startTime.toISOString()}`);
            if (!response.ok) throw new Error('Failed to fetch calendar data.');
            
            const events = await response.json();
            const isConflict = events.some(event => {
                const eventStart = new Date(event.start.dateTime);
                const eventEnd = new Date(event.end.dateTime);
                return startTime < eventEnd && endTime > eventStart;
            });

            if (isConflict) {
                availabilityStatusElement.textContent = 'Not Available';
                availabilityStatusElement.className = 'availability-status unavailable';
                submitButton.disabled = true;
            } else {
                availabilityStatusElement.textContent = 'Available';
                availabilityStatusElement.className = 'availability-status available';
                submitButton.disabled = false;
            }
        } catch (error) {
            console.error('Availability check error:', error);
            statusMessageElement.textContent = 'Could not verify availability. Please try again.';
            statusMessageElement.className = 'message error';
            submitButton.disabled = false;
        }
    };

    const debouncedCheckAvailability = debounce(checkAvailability, 500);

    serviceTypeElement.addEventListener('change', debouncedCheckAvailability);
    timeSelectionElement.addEventListener('change', debouncedCheckAvailability);

    bookingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const service = serviceTypeElement.value;
        const selectedDate = dateSelectionElement.value;
        const selectedTime = timeSelectionElement.value;

        if (!service || !selectedDate || !selectedTime) {
            statusMessageElement.textContent = 'Please ensure all fields are selected.';
            statusMessageElement.className = 'message error';
            return;
        }

        statusMessageElement.textContent = 'Submitting your booking...';
        statusMessageElement.className = 'message';
        submitButton.disabled = true;

        const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
        const serviceDuration = serviceDurations[service];
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + serviceDuration);

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
                // --- SHOW SUCCESS MODAL ---
                const selectedServiceText = serviceTypeElement.options[serviceTypeElement.selectedIndex].text;
                const formattedDate = new Date(startTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const formattedTime = new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                summaryService.textContent = selectedServiceText;
                summaryDate.textContent = formattedDate;
                summaryTime.textContent = formattedTime;

                successModalOverlay.classList.add('active');
                bookingForm.style.display = 'none'; // Hide form after successful booking
                statusMessageElement.style.display = 'none';

            } else {
                statusMessageElement.textContent = `Error: ${data.message}`;
                statusMessageElement.className = 'message error';
                if (data.conflict) sendConflictEmail(data.conflict);
                submitButton.disabled = false;
            }
        } catch (error) {
            console.error('Booking submission error:', error);
            statusMessageElement.textContent = 'A network error occurred. Please try again later.';
            statusMessageElement.className = 'message error';
            submitButton.disabled = false;
        }
    });

    function closeAndReset() {
        successModalOverlay.classList.remove('active');
        bookingForm.reset();
        fp.clear();
        availabilityStatusElement.textContent = '';
        bookingForm.style.display = 'block'; // Show the form again
        submitButton.disabled = false;
    }

    closeSuccessModalBtn.addEventListener('click', closeAndReset);
    newBookingBtn.addEventListener('click', closeAndReset);
    successModalOverlay.addEventListener('click', (e) => {
        if (e.target === successModalOverlay) {
            closeAndReset();
        }
    });

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
