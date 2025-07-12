document.addEventListener('DOMContentLoaded', () => {
    const serviceType = document.getElementById('service-type');
    const dateSelection = document.getElementById('date-selection');
    const timeSlotModal = document.getElementById('time-slot-modal');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const confirmBooking = document.getElementById('confirm-booking');
    const closeModal = document.querySelector('.close-button');
    const statusMessage = document.getElementById('status-message');
    const bookingForm = document.getElementById('booking-form');

    let selectedDate = null;
    let selectedTimeSlot = null;

    const serviceDurations = {
        'Interior': 4, // 4 hours
        'Bedliner': 8, // 8 hours
        'Body': 8,     // 8 hours
    };

    const fp = flatpickr(dateSelection, {
        minDate: 'today',
        onChange: (selectedDates) => {
            selectedDate = selectedDates[0];
            if (selectedDate) {
                fetchAvailableTimeSlots(selectedDate);
            }
        },
        "disableMobile": true, // Disable mobile-friendly rendering to ensure flatpickr is always used
        clickOpens: true // Ensure clicking the input opens the calendar
    });

    // Open flatpickr when the input field is focused or clicked
    dateSelection.addEventListener('focus', () => {
        fp.open();
    });

    dateSelection.addEventListener('click', () => {
        fp.open();
    });

    async function fetchAvailableTimeSlots(date) {
        const service = serviceType.value;
        const response = await fetch(`/.netlify/functions/server/get-events?date=${date.toISOString()}`);
        const events = await response.json();

        const businessHours = { start: 9, end: 17 }; // 9 AM to 5 PM
        const timeSlots = [];
        const serviceDuration = serviceDurations[service];

        for (let hour = businessHours.start; hour <= businessHours.end - serviceDuration; hour++) {
            const slotStart = new Date(date);
            slotStart.setHours(hour, 0, 0, 0);

            const slotEnd = new Date(slotStart);
            slotEnd.setHours(slotStart.getHours() + serviceDuration);

            const isBooked = events.some(event => {
                const eventStart = new Date(event.start.dateTime);
                const eventEnd = new Date(event.end.dateTime);
                return (slotStart < eventEnd && slotEnd > eventStart);
            });

            if (!isBooked) {
                timeSlots.push(slotStart);
            }
        }

        populateTimeSlots(timeSlots);
    }

    function populateTimeSlots(slots) {
        timeSlotsContainer.innerHTML = '';
        if (slots.length === 0) {
            timeSlotsContainer.innerHTML = '<p>No available time slots for this day.</p>';
            return;
        }

        slots.forEach(slot => {
            const button = document.createElement('button');
            button.className = 'time-slot';
            button.textContent = slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            button.onclick = () => {
                selectedTimeSlot = slot;
                // Highlight the selected button
                document.querySelectorAll('.time-slot').forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
            };
            timeSlotsContainer.appendChild(button);
        });

        timeSlotModal.style.display = 'block';
    }

    confirmBooking.onclick = async () => {
        if (!selectedTimeSlot) {
            alert('Please select a time slot.');
            return;
        }

        const service = serviceType.value;
        const serviceDuration = serviceDurations[service];
        const endTime = new Date(selectedTimeSlot);
        endTime.setHours(endTime.getHours() + serviceDuration);

        const response = await fetch('/.netlify/functions/server/create-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: service,
                startTime: selectedTimeSlot.toISOString(),
                endTime: endTime.toISOString(),
            }),
        });

        const data = await response.json();

        if (response.ok) {
            statusMessage.textContent = 'Booking request successful! We will contact you to confirm.';
            timeSlotModal.style.display = 'none';
        } else {
            statusMessage.textContent = `Error: ${data.message}`;
            if (data.conflict) {
                sendConflictEmail(data.conflict);
            }
        }
    };

    closeModal.onclick = () => {
        timeSlotModal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target == timeSlotModal) {
            timeSlotModal.style.display = 'none';
        }
    };

    async function sendConflictEmail(conflictDetails) {
        await fetch('/.netlify/functions/server/send-conflict-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conflictDetails),
        });
    }

    // Handle the main booking form submission
    bookingForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        let isValid = true;
        const requiredFields = this.querySelectorAll('[required]');

        requiredFields.forEach(field => {
            // Assuming no specific error display elements for now, just basic validation
            if (!field.value.trim()) {
                field.classList.add('invalid');
                isValid = false;
            } else {
                field.classList.remove('invalid');
            }
        });

        if (!selectedDate || !selectedTimeSlot) {
            statusMessage.textContent = 'Please select a date and time slot.';
            statusMessage.style.display = 'block';
            isValid = false;
        } else {
            statusMessage.style.display = 'none';
        }

        if (!isValid) {
            return;
        }

        // If validation passes, proceed with booking (this part is handled by confirmBooking.onclick)
        // For now, we'll just show a success message or trigger the modal if not already open
        if (selectedDate && selectedTimeSlot) {
            // This means the user has already selected a date and time via the flatpickr and modal
            // The confirmBooking.onclick would have already been triggered.
            // So, this submit event is more for initial validation before opening the modal.
            // If the modal is not open, open it.
            if (timeSlotModal.style.display === 'none' || timeSlotModal.style.display === '') {
                populateTimeSlots([]); // Re-populate to show selected time if any, or just open modal
            }
        } else {
            // If date/time not selected, flatpickr should open and then the modal
            fp.open();
        }
    });
});