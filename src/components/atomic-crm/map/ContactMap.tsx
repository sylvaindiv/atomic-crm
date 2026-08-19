import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { useNavigate } from "react-router";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { ContactMapPoint } from "./useGeocodedContacts";

const FRANCE_CENTER: [number, number] = [46.6, 1.88];
const FRANCE_ZOOM = 6;

export const ContactMap = ({ points }: { points: ContactMapPoint[] }) => {
  const { noteStatuses } = useConfigurationContext();
  const navigate = useNavigate();

  return (
    <MapContainer
      center={FRANCE_CENTER}
      zoom={FRANCE_ZOOM}
      className="h-full w-full rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map(({ contact, lat, lng }) => {
        const statusObject = noteStatuses.find(
          (s) => s.value === contact.status,
        );
        const color = statusObject?.color ?? "#999999";
        return (
          <CircleMarker
            key={contact.id}
            center={[lat, lng]}
            radius={11}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.8,
            }}
            eventHandlers={{
              mouseover: (e) => e.target.openPopup(),
              mouseout: (e) => e.target.closePopup(),
              click: () => navigate(`/contacts/${contact.id}/show`),
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-medium">
                  {contact.first_name} {contact.last_name}
                </p>
                {statusObject && <p>{statusObject.label}</p>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
};
