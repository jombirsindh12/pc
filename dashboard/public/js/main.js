/**
 * Main JavaScript for Phantom Guard Dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
    // Enable all tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => {
        new bootstrap.Tooltip(tooltip);
    });

    // Enable all popovers
    const popovers = document.querySelectorAll('[data-bs-toggle="popover"]');
    popovers.forEach(popover => {
        new bootstrap.Popover(popover);
    });

    // Add fade effect to alerts
    setTimeout(() => {
        document.querySelectorAll('.alert.alert-success').forEach(alert => {
            alert.classList.add('fade');
            setTimeout(() => {
                alert.remove();
            }, 500);
        });
    }, 3000);

    // Add active class to current page in navbar
    const currentPath = window.location.pathname;
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Handle form submission status indicators
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(event) {
            // Show loading state
            this.classList.add('loading');
            
            // Add or create submit button spinner
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...`;
                
                // Store original text for later restoration
                submitBtn.dataset.originalText = originalText;
            }
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Dark mode toggle (if present)
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
        
        // Check for saved dark mode preference
        if (localStorage.getItem('darkMode') === 'enabled') {
            darkModeToggle.checked = true;
            document.body.classList.add('dark-mode');
        }
    }

    // Mobile navigation toggle
    const navbarToggler = document.querySelector('.navbar-toggler');
    if (navbarToggler) {
        navbarToggler.addEventListener('click', function() {
            document.body.classList.toggle('mobile-nav-open');
        });
    }

    // Handle card expansion (for mobile view)
    document.querySelectorAll('.card-header-action').forEach(header => {
        header.addEventListener('click', function() {
            const card = this.closest('.card');
            const cardBody = card.querySelector('.card-body');
            
            if (cardBody.style.display === 'none') {
                cardBody.style.display = 'block';
                this.querySelector('i').classList.replace('bi-chevron-down', 'bi-chevron-up');
            } else {
                cardBody.style.display = 'none';
                this.querySelector('i').classList.replace('bi-chevron-up', 'bi-chevron-down');
            }
        });
    });

    // Initialize any range sliders
    document.querySelectorAll('input[type="range"]').forEach(range => {
        const output = document.getElementById(range.id + 'Value');
        if (output) {
            output.textContent = range.value;
            
            range.addEventListener('input', function() {
                output.textContent = this.value;
            });
        }
    });
    
    // Add animation to stat numbers
    document.querySelectorAll('.stat-number').forEach(stat => {
        const targetValue = parseInt(stat.textContent, 10);
        let currentValue = 0;
        const duration = 1000; // 1 second
        const frameRate = 30; // frames per second
        const increment = targetValue / (duration / 1000 * frameRate);
        
        if (!isNaN(targetValue)) {
            stat.textContent = '0';
            
            const counter = setInterval(() => {
                currentValue += increment;
                
                if (currentValue >= targetValue) {
                    clearInterval(counter);
                    stat.textContent = targetValue.toLocaleString();
                } else {
                    stat.textContent = Math.floor(currentValue).toLocaleString();
                }
            }, 1000/frameRate);
        }
    });

    console.log('Phantom Guard Dashboard initialized');
});