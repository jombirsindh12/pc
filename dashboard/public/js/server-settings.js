/**
 * Server Settings JavaScript for Phantom Guard Dashboard
 * Handles all AJAX calls and UI interactions for the server settings page
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get the current server ID from URL
    const pathname = window.location.pathname;
    const guildId = pathname.split('/').pop();
    
    // Handle general settings form
    const generalSettingsForm = document.getElementById('generalSettingsForm');
    if (generalSettingsForm) {
        generalSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const prefix = document.getElementById('prefix').value;
            const notificationChannel = document.getElementById('notificationChannel').value;
            const deleteCommands = document.getElementById('deleteCommands').checked;
            
            // Update settings via API
            updateSettings(guildId, 'prefix', prefix);
            updateSettings(guildId, 'notificationChannelId', notificationChannel);
            updateSettings(guildId, 'deleteCommands', deleteCommands);
            
            showToast('General settings saved successfully!');
        });
    }
    
    // Handle verification settings form
    const verificationSettingsForm = document.getElementById('verificationSettingsForm');
    if (verificationSettingsForm) {
        verificationSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const youtubeChannel = document.getElementById('youtubeChannel').value;
            const verificationChannel = document.getElementById('verificationChannel').value;
            const verifiedRole = document.getElementById('verifiedRole').value;
            const unverifiedRole = document.getElementById('unverifiedRole').value;
            const autoVerification = document.getElementById('autoVerification').checked;
            
            // Update settings via API
            updateSettings(guildId, 'youtubeChannelId', youtubeChannel);
            updateSettings(guildId, 'verificationChannelId', verificationChannel);
            updateSettings(guildId, 'roleId', verifiedRole);
            updateSettings(guildId, 'unverifiedRoleId', unverifiedRole);
            updateSettings(guildId, 'autoVerification', autoVerification);
            
            showToast('Verification settings saved successfully!');
        });
    }
    
    // Handle security settings form
    const securitySettingsForm = document.getElementById('securitySettingsForm');
    if (securitySettingsForm) {
        securitySettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const antiNuke = document.getElementById('antiNuke').checked;
            const nukeThreshold = document.getElementById('nukeThreshold').value;
            const antiRaid = document.getElementById('antiRaid').checked;
            const raidThreshold = document.getElementById('raidThreshold').value;
            const raidTime = document.getElementById('raidTime').value;
            const emergencyLockdown = document.getElementById('emergencyLockdown').checked;
            
            // Create a security settings object
            const securitySettings = {
                antiNuke: antiNuke,
                nukeThreshold: parseInt(nukeThreshold),
                antiRaid: antiRaid,
                raidThreshold: parseInt(raidThreshold),
                raidTimeSeconds: parseInt(raidTime),
                lockdownEnabled: emergencyLockdown
            };
            
            // Update settings via API
            updateSettings(guildId, 'security', securitySettings);
            
            showToast('Security settings saved successfully!');
        });
    }
    
    // Handle voice settings form
    const voiceSettingsForm = document.getElementById('voiceSettingsForm');
    if (voiceSettingsForm) {
        voiceSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const voiceAnnouncements = document.getElementById('voiceAnnouncements').checked;
            const voiceLanguage = document.getElementById('voiceLanguage').value;
            const liveSubCountFormat = document.getElementById('liveSubCountFormat').value;
            const updateFrequency = document.getElementById('updateFrequency').value;
            
            // Update settings via API
            updateSettings(guildId, 'voiceAnnouncements', voiceAnnouncements);
            updateSettings(guildId, 'language', voiceLanguage);
            updateSettings(guildId, 'voiceChannelFormat', liveSubCountFormat);
            updateSettings(guildId, 'updateFrequencyMinutes', parseInt(updateFrequency));
            
            showToast('Voice settings saved successfully!');
        });
    }
    
    // Handle logging settings form
    const loggingSettingsForm = document.getElementById('loggingSettingsForm');
    if (loggingSettingsForm) {
        // Enable/disable logging form elements based on enableLogging checkbox
        const enableLoggingCheckbox = document.getElementById('enableLogging');
        if (enableLoggingCheckbox) {
            enableLoggingCheckbox.addEventListener('change', function() {
                const formElements = loggingSettingsForm.querySelectorAll('select, input:not(#enableLogging), button');
                formElements.forEach(element => {
                    element.disabled = !this.checked;
                });
            });
        }
        
        loggingSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const enableLogging = document.getElementById('enableLogging').checked;
            const logChannel = document.getElementById('logChannel').value;
            
            // Get all checked log types
            const logTypes = [];
            if (document.getElementById('logModeration').checked) logTypes.push('moderation');
            if (document.getElementById('logMembers').checked) logTypes.push('members');
            if (document.getElementById('logMessages').checked) logTypes.push('messages');
            if (document.getElementById('logVerification').checked) logTypes.push('verification');
            if (document.getElementById('logSecurity').checked) logTypes.push('security');
            if (document.getElementById('logVoice').checked) logTypes.push('voice');
            
            // Create a logging settings object
            const loggingSettings = {
                enabled: enableLogging,
                channelId: logChannel,
                types: logTypes
            };
            
            // Update settings via API
            updateSettings(guildId, 'logging', loggingSettings);
            
            showToast('Logging settings saved successfully!');
        });
    }
    
    // Handle CAPTCHA settings
    const enableCaptchaCheckbox = document.getElementById('enableCaptcha');
    const captchaTypeSelect = document.getElementById('captchaType');
    const saveCaptchaBtn = document.getElementById('saveCaptchaBtn');
    
    if (enableCaptchaCheckbox && captchaTypeSelect && saveCaptchaBtn) {
        enableCaptchaCheckbox.addEventListener('change', function() {
            captchaTypeSelect.disabled = !this.checked;
            saveCaptchaBtn.disabled = !this.checked;
        });
        
        saveCaptchaBtn.addEventListener('click', function() {
            const captchaSettings = {
                enabled: enableCaptchaCheckbox.checked,
                type: captchaTypeSelect.value
            };
            
            // Update settings via API
            updateSettings(guildId, 'captcha', captchaSettings);
            
            showToast('CAPTCHA settings saved successfully!');
        });
    }
    
    // Handle emergency lockdown button
    const triggerLockdownBtn = document.getElementById('triggerLockdownBtn');
    if (triggerLockdownBtn) {
        triggerLockdownBtn.addEventListener('click', function() {
            const isInLockdown = this.innerText.includes('End Lockdown');
            
            // Confirm action
            if (!confirm(`Are you sure you want to ${isInLockdown ? 'end' : 'trigger'} server lockdown? ${
                isInLockdown ? 'This will restore normal access to the server.' : 
                'This will restrict all member permissions and prevent new messages in channels.'
            }`)) {
                return;
            }
            
            // Update lockdown status
            updateSettings(guildId, 'security.inLockdown', !isInLockdown);
            
            // Update button text
            this.innerHTML = isInLockdown ? 
                '<i class="bi bi-exclamation-triangle"></i> Trigger Lockdown' : 
                '<i class="bi bi-exclamation-triangle"></i> End Lockdown';
                
            showToast(`Server ${isInLockdown ? 'lockdown ended' : 'lockdown activated'}!`);
        });
    }
    
    // Handle test voice announcement button
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', function() {
            // Call the test voice announcement API
            fetch(`/api/${guildId}/testVoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast('Test announcement sent!');
                } else {
                    showToast('Failed to send test announcement: ' + data.error, 'error');
                }
            })
            .catch(error => {
                showToast('Error: ' + error.message, 'error');
            });
        });
    }
    
    // Function to update settings via API
    function updateSettings(guildId, setting, value) {
        fetch(`/api/${guildId}/updateSettings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                setting: setting,
                value: value
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update settings');
            }
            return response.json();
        })
        .then(data => {
            console.log(`Setting ${setting} updated:`, data);
        })
        .catch(error => {
            console.error('Error updating settings:', error);
            showToast('Error saving settings: ' + error.message, 'error');
        });
    }
    
    // Function to show toast notifications
    function showToast(message, type = 'success') {
        // Check if toast container exists, if not create it
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Create a unique ID for this toast
        const toastId = 'toast-' + Date.now();
        
        // Create toast HTML
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        // Add toast to container
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        // Initialize and show toast
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();
        
        // Remove toast from DOM after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function() {
            this.remove();
        });
    }
});