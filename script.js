// Configuration
const CONFIG = {
    CLIENT_ID: 'e1ad0d39ffc4446182ef0bd346089c71',
    CLIENT_SECRET: 'e96bf44ae52c4e54b5e989a8a58b2e01',
    DEFAULT_TRACK: '2ay7Y6gHJPpXQJmboKB6zT',
    MIN_LOADING_TIME: 100
};

// DOM Elements
const DOM = {
    init() {
        this.urlInput = document.getElementById('spotify-url');
        this.generateBtn = document.getElementById('generate-btn');
        this.regenerateBtn = document.getElementById('regenerate-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.shareBtn = document.getElementById('share-btn');
        this.watermarkToggle = document.getElementById('watermark-toggle');
        this.customWatermarkToggle = document.getElementById('custom-watermark-toggle');
        this.customWatermarkInput = document.getElementById('custom-watermark-input');
        this.watermark = document.getElementById('watermark');
        this.graphic = document.getElementById('graphic');
        this.loader = document.getElementById('loader-container');
        
        // Initially hide all UI elements except loader
        this.graphic.style.display = 'none';
        this.graphic.style.opacity = '0';
        this.generateBtn.style.display = 'none';
        this.regenerateBtn.style.display = 'none';
        this.downloadBtn.style.display = 'none';
        this.shareBtn.style.display = 'none';
        this.loader.style.display = 'flex';
        
        return this;
    }
};

// Spotify API Handler
class SpotifyAPI {
    static accessToken = '';

    static async getAccessToken() {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(CONFIG.CLIENT_ID + ':' + CONFIG.CLIENT_SECRET)
            },
            body: 'grant_type=client_credentials'
        });
        const data = await response.json();
        this.accessToken = data.access_token;
    }

    static getTrackId(url) {
        const regex = /track\/([a-zA-Z0-9]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    static async getTrackInfo(trackId) {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });
        return await response.json();
    }
}

// Graphic Generator
class GraphicGenerator {
    static colorThief = new ColorThief();

    static getContrastRatio(rgb) {
        const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        return luminance > 0.5 ? 'black' : 'white';
    }

    static rgbToHex(r, g, b) {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    static async updateGraphic(trackInfo, isInitialLoad = false) {
        const albumArt = document.getElementById('album-art');
        
        if (!isInitialLoad) {
            DOM.urlInput.disabled = true;
            DOM.urlInput.value = `https://open.spotify.com/track/${trackInfo.id}`;
        }
        
        albumArt.src = trackInfo.album.images[0].url;
        
        albumArt.onload = () => {
            const dominantColor = this.colorThief.getColor(albumArt);
            const backgroundColor = `rgb(${dominantColor.join(',')})`;
            const textColor = this.getContrastRatio(dominantColor);
            const hexColor = this.rgbToHex(...dominantColor);
            
            DOM.graphic.style.backgroundColor = backgroundColor;
            document.querySelector('.song-title').style.color = textColor;
            document.querySelector('.artist-name').style.color = 
                textColor === 'white' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
            document.querySelector('.watermark').style.color = 
                textColor === 'white' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
            
            document.getElementById('spotify-code').src = 
                `https://scannables.scdn.co/uri/plain/jpeg/${hexColor}/${textColor}/640/spotify:track:${trackInfo.id}`;

            // Show graphic after everything is loaded
            this.toggleUI(true, isInitialLoad);
        };

        document.getElementById('song-title').textContent = trackInfo.name;
        document.getElementById('artist-name').textContent = 
            trackInfo.artists.map(artist => artist.name).join(', ');
    }

    static toggleUI(show, isInitialLoad = false) {
        // Fade out loader
        DOM.loader.style.opacity = '0';
        setTimeout(() => {
            DOM.loader.style.display = 'none';
            DOM.loader.style.opacity = '1';
        }, 300);

        // Show or hide graphic with fade
        if (show) {
            setTimeout(() => {
                DOM.graphic.style.opacity = '0';
                DOM.graphic.style.display = 'flex';
                setTimeout(() => {
                    DOM.graphic.style.opacity = '1';
                }, 50);
            }, 300);
        } else {
            DOM.graphic.style.opacity = '0';
            setTimeout(() => {
                DOM.graphic.style.display = 'none';
            }, 300);
        }
        
        if (isInitialLoad) {
            // For initial load, show only the generate button
            setTimeout(() => {
                DOM.generateBtn.style.display = 'block';
                DOM.generateBtn.style.opacity = '0';
                requestAnimationFrame(() => {
                    DOM.generateBtn.style.opacity = '1';
                });
            }, 400);
        } else if (show) {
            // For regular generation
            DOM.generateBtn.style.display = 'none';
            DOM.regenerateBtn.style.display = 'flex';
            DOM.downloadBtn.style.display = 'block';
        } else {
            // For regeneration (reset state)
            DOM.generateBtn.style.display = 'block';
            DOM.regenerateBtn.style.display = 'none';
            DOM.downloadBtn.style.display = 'none';
        }
        
        DOM.shareBtn.style.display = show ? 'block' : 'none';
    }

    static async shareGraphic() {
        try {
            const originalBorderRadius = DOM.graphic.style.borderRadius;
            DOM.graphic.style.borderRadius = '0';

            const canvas = await html2canvas(DOM.graphic, {
                scale: 2,
                useCORS: true,
                allowTaint: true
            });

            DOM.graphic.style.borderRadius = originalBorderRadius;
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            const file = new File([blob], 'spotishare.png', { type: 'image/png' });
            
            if (navigator.share) {
                await navigator.share({
                    files: [file],
                    title: 'SpotiShare',
                    text: 'Check out this song!'
                });
            } else {
                alert('Sharing is not supported on this device/browser');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    }
}

// Main App
class App {
    static async init() {
        DOM.init();
        await this.setupEventListeners();
        await this.loadDefaultTrack();
    }

    static async setupEventListeners() {
        try {
            await SpotifyAPI.getAccessToken();
        } catch (error) {
            alert('Failed to connect to Spotify API');
            return;
        }

        DOM.urlInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await this.handleGeneration();
            }
        });

        DOM.generateBtn.addEventListener('click', () => this.handleGeneration());
        DOM.regenerateBtn.addEventListener('click', () => this.handleRegeneration());
        DOM.downloadBtn.addEventListener('click', () => this.handleDownload());
        DOM.shareBtn.addEventListener('click', () => GraphicGenerator.shareGraphic());
        
        // Watermark toggles and custom watermark handlers
        DOM.watermarkToggle.addEventListener('change', (e) => {
            if (!DOM.customWatermarkToggle.checked) {
                DOM.watermark.style.display = e.target.checked ? 'none' : 'block';
            }
        });

        DOM.customWatermarkToggle.addEventListener('change', (e) => {
            const isCustom = e.target.checked;
            DOM.customWatermarkInput.style.display = isCustom ? 'block' : 'none';
            DOM.watermarkToggle.disabled = isCustom;
            
            if (!isCustom) {
                // Reset to default watermark
                DOM.watermark.textContent = 'navida.design';
                DOM.watermark.style.display = DOM.watermarkToggle.checked ? 'none' : 'block';
            }
        });

        DOM.customWatermarkInput.addEventListener('input', (e) => {
            const customText = e.target.value.trim();
            DOM.watermark.textContent = customText || 'navida.design';
        });

        DOM.customWatermarkInput.addEventListener('blur', () => {
            if (DOM.graphic.style.display === 'flex') {
                this.handleGeneration(true);
            }
        });
    }

    static async handleGeneration(isWatermarkUpdate = false) {
        if (!isWatermarkUpdate) {
            DOM.loader.style.display = 'flex';
            const startTime = Date.now();
            const trackId = SpotifyAPI.getTrackId(DOM.urlInput.value);
            
            if (!trackId) {
                alert('Invalid Spotify URL');
                DOM.loader.style.display = 'none';
                return;
            }

            try {
                const trackInfo = await SpotifyAPI.getTrackInfo(trackId);
                
                const elapsedTime = Date.now() - startTime;
                if (elapsedTime < CONFIG.MIN_LOADING_TIME) {
                    await new Promise(resolve => setTimeout(resolve, CONFIG.MIN_LOADING_TIME - elapsedTime));
                }
                
                await GraphicGenerator.updateGraphic(trackInfo);
            } catch (error) {
                alert('Failed to fetch track information');
                DOM.loader.style.display = 'none';
            }
        } else {
            // Just update the watermark visibility and text
            if (DOM.customWatermarkToggle.checked) {
                const customText = DOM.customWatermarkInput.value.trim();
                DOM.watermark.textContent = customText || 'navida.design';
                DOM.watermark.style.display = 'block';
            } else {
                DOM.watermark.textContent = 'navida.design';
                DOM.watermark.style.display = DOM.watermarkToggle.checked ? 'none' : 'block';
            }
        }
    }

    static handleRegeneration() {
        DOM.urlInput.value = '';
        DOM.urlInput.disabled = false;
        GraphicGenerator.toggleUI(false);
        
        // Ensure generate button is visible and styled correctly
        setTimeout(() => {
            DOM.generateBtn.style.opacity = '1';
            DOM.generateBtn.style.display = 'block';
        }, 400);
    }

    static async loadDefaultTrack() {
        try {
            const trackInfo = await SpotifyAPI.getTrackInfo(CONFIG.DEFAULT_TRACK);
            
            await new Promise(resolve => setTimeout(resolve, CONFIG.MIN_LOADING_TIME));
            
            await GraphicGenerator.updateGraphic(trackInfo, true);
        } catch (error) {
            console.error('Failed to load default track:', error);
            DOM.loader.style.display = 'none';
            DOM.generateBtn.style.display = 'block';
            DOM.generateBtn.style.opacity = '1';
        }
    }

    static async handleDownload() {
        const canvas = await html2canvas(DOM.graphic, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            onclone: (clonedDoc) => {
                clonedDoc.getElementById('graphic').style.borderRadius = '0';
                clonedDoc.getElementById('graphic').style.display = 'flex';
            }
        });
        
        const link = document.createElement('a');
        link.download = 'spotify-share.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());