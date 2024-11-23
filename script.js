// Global Variables
let map;
let rectangle;
let selectedArea = []; // To store the rectangle coordinates
let drawingManager;
let accessToken = ""; // Variable to store the access token

/**
 * Initialize the Google Map and Drawing Manager.
 */
function initMap() {
    map = createMap();
    setupDrawingManager(map);
    setupSubmitButton();
    requestToken();  // Request token on page load
}

/**
 * Create and configure the map.
 */
function createMap() {
    return new google.maps.Map(document.getElementById("map"), {
        center: { lat: 41.870072, lng: 12.44693 }, // Example: Rome, Italy
        zoom: 13,
        gestureHandling: "greedy", // Smooth interaction for touch devices
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
    });
}

/**
 * Set up the drawing manager and handle rectangle creation.
 */
function setupDrawingManager(mapInstance) {
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
        rectangleOptions: {
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            strokeWeight: 2,
            strokeColor: "#FF0000",
            clickable: true,
            editable: true,
            draggable: true,
        },
    });

    drawingManager.setMap(mapInstance);

    // Event listener for rectangle creation
    google.maps.event.addListener(drawingManager, 'overlaycomplete', handleRectangleComplete);
}

/**
 * Handle the completion of rectangle drawing.
 */
function handleRectangleComplete(event) {
    // Remove existing rectangle if present
    if (rectangle) rectangle.setMap(null);

    // Set the new rectangle
    rectangle = event.overlay;

    // Get and store the rectangle bounds
    const bounds = rectangle.getBounds();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    selectedArea = [
        [southWest.lng(), southWest.lat()],
        [northEast.lng(), northEast.lat()]
    ];

    console.log("Rectangle coordinates:", selectedArea);
}

/**
 * Set up the submit button to send coordinates to the Sentinel Hub API.
 */
function setupSubmitButton() {
    const submitButton = document.getElementById("submit-btn");
    submitButton.addEventListener("click", submitCoordinates);
}

/**
 * Request the access token from the Sentinel Hub API.
 */
function requestToken() {
    const myHeaders = new Headers();
    myHeaders.append("content-type", "application/x-www-form-urlencoded");
    myHeaders.append("User-Agent", "PostmanRuntime/7.42.0");
    myHeaders.append("Accept", "*/*");
    myHeaders.append("Cache-Control", "no-cache");
    myHeaders.append("Postman-Token", "64653592-41df-4412-96f3-95c199556938");
    myHeaders.append("Host", "services.sentinel-hub.com");
    myHeaders.append("Accept-Encoding", "gzip, deflate, br");
    myHeaders.append("Connection", "keep-alive");
    myHeaders.append("Content-Length", "123");

    const urlencoded = new URLSearchParams();
    urlencoded.append("grant_type", "client_credentials");
    urlencoded.append("client_id", "f0a3290b-4cd5-4540-b1aa-eb6a2b8c956a");
    urlencoded.append("client_secret", "6H2Lu27EaXKw4xZ4pz7L8AqQRVrbRzVP");

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow"
    };

    fetch("https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token", requestOptions)
        .then((response) => response.json())
        .then((result) => {
            accessToken = result.access_token;  // Store the access token
            console.log("Access token received:", accessToken);
        })
        .catch((error) => console.error("Error fetching access token:", error));
}

/**
 * Submit the rectangle coordinates to the Sentinel Hub API.
 */
function submitCoordinates() {
    if (selectedArea.length === 0) {
        alert("Please draw a rectangle first.");
        return;
    }

    if (!accessToken) {
        alert("Access token not available.");
        return;
    }

    const apiUrl = 'https://services.sentinel-hub.com/api/v1/process';
    const requestBody = createApiRequestBody();

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`  // Use the access token here
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => response.json())
    .then(handleApiResponse)
    .catch(handleApiError);
}

/**
 * Create the request body for the Sentinel Hub API.
 */
function createApiRequestBody() {
    return {
        input: {
            bounds: {
                bbox: selectedArea.flat() // Flatten the coordinates array
            },
            data: [
                {
                    dataFilter: {
                        timeRange: {
                            from: "2024-10-23T00:00:00Z",
                            to: "2024-11-18T23:59:59Z"
                        }
                    },
                    type: "sentinel-2-l2a"
                }
            ]
        },
        output: {
            width: 512,
            height: 520.193,
            responses: [
                {
                    identifier: "default",
                    format: {
                        type: "image/jpeg"
                    }
                }
            ]
        },
        evalscript: "//VERSION=3\n\nfunction setup() {\n  return {\n    input: [\"B02\", \"B03\", \"B04\"],\n    output: { bands: 3 }\n  };\n}\n\nfunction evaluatePixel(sample) {\n  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];\n}"
    };
}

/**
 * Handle the API response and display the image in the popup.
 */
function handleApiResponse(data) {
    console.log("Response from Sentinel Hub:", data);
    
    const imageUrl = data.response[0].url; // Adjust this based on actual API response structure
    if (!imageUrl) {
        alert("No image received.");
        return;
    }

    const imageElement = document.getElementById("response-image");
    imageElement.src = imageUrl;

    const popup = document.getElementById("popup");
    popup.classList.remove("hidden");

    document.getElementById("close-popup").addEventListener("click", () => {
        popup.classList.add("hidden");
    });

    console.log("Image displayed in popup.");
}

/**
 * Handle errors during the API request.
 */
function handleApiError(error) {
    console.error("Error submitting request:", error);
    alert("Error submitting request.");
}

// Initialize the map on window load
window.onload = initMap;
