# Touring & Road Manager Module (RC1)

The Touring module is a specialized suite for the logistics, management, and execution of independent tours. It serves as a digital **Road Manager**, bridging the gap between show booking and show execution.

## 🚐 Key Features
- **Route Planning:** Intelligent routing between venues with mileage and fuel estimations.
- **Venue Discovery:** Real-time search and metadata extraction for independent venues.
- **Show Advance:** Centralized repository for tech riders, hospitality riders, and load-in schedules.
- **Tour Finance:** Real-time tracking of tour expenses (gas, lodging, food) and show settlement (guarantees, percentages).
- **Logistics Dashboard:** A unified view of travel times, soundcheck times, and showtimes.

## 🏗️ Technical Architecture
- **`RoadManagerService`**: The core business logic for tour routing and venue management.
- **`TourDashboard`**: Interactive UI for artists, tour managers, and crew.
- **Typescript Models**: Strict type definitions for `TourStop`, `Venue`, and `Logistics`.
- **Google Maps Integration:** Direct API integration for routing, distance calculations, and location data.

## 🔗 Integrations
- **Finance Module:** Automated reconciliation of tour expenses and income.
- **Marketing Module:** Direct link between tour dates and social media promotion.
- **Legal Agent:** Automated review of performance contracts and riders.
