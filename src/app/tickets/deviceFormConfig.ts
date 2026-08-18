import { DEVICE_KEYS, type DeviceKey } from '@/lib/nexus/devices';

export type FieldDef =
  | { kind: 'text'; name: string; label: string; required?: boolean }
  | { kind: 'number'; name: string; label: string; required?: boolean; min?: number; max?: number; step?: number }
  | { kind: 'select'; name: string; label: string; options: string[]; required?: boolean }
  | { kind: 'date'; name: string; label: string; required?: boolean }
  | { kind: 'checkboxGroup'; name: string; label: string; options: { key: string; label: string }[] };

export const DEVICE_TYPE_LABELS: Record<DeviceKey, string> = {
  air_conditioner: 'Air Conditioner',
  master_purifier: 'Master Purifier',
  fridge: 'Fridge',
  washing_machine: 'Washing Machine',
  geyser: 'Geyser',
};

// Complaint titles are free text built client-side from CMS-editable device-type labels
// (e.g. "Service: Refrigerator ×1, Geyser ×1"), so there's no fixed enum → title-string
// mapping to rely on. This matches common label variants seen for each type instead.
const DEVICE_KEY_SYNONYMS: Record<DeviceKey, string[]> = {
  air_conditioner: ['air conditioner', 'ac'],
  master_purifier: ['master purifier', 'water purifier', 'purifier', 'ro'],
  fridge: ['refrigerator', 'fridge'],
  washing_machine: ['washing machine', 'washer'],
  geyser: ['geyser', 'water heater'],
};

/** Device types mentioned by name in a complaint's title, e.g. "Refrigerator ×1, Geyser ×1"
 *  → ['fridge', 'geyser']. Falls back to every type if the title doesn't name any of them,
 *  so free-text complaints without recognizable device names still let you add an appliance. */
export function resolveRequestedDeviceKeys(title: string): DeviceKey[] {
  const normalized = title.toLowerCase();
  const matched = DEVICE_KEYS.filter((key) => DEVICE_KEY_SYNONYMS[key].some((synonym) => normalized.includes(synonym)));
  return matched.length > 0 ? matched : [...DEVICE_KEYS];
}

const COMMON_TAIL: FieldDef[] = [
  { kind: 'number', name: 'starRating', label: 'Star Rating (0-5)', min: 0, max: 5 },
  { kind: 'text', name: 'notes', label: 'Notes' },
];

export const DEVICE_FORM_FIELDS: Record<DeviceKey, FieldDef[]> = {
  air_conditioner: [
    { kind: 'text', name: 'company', label: 'Company', required: true },
    { kind: 'select', name: 'coolingType', label: 'Cooling Type', options: ['SPLIT_UNIT', 'WINDOW_UNIT'], required: true },
    { kind: 'select', name: 'technology', label: 'Technology', options: ['INVERTER', 'FIXED_SPEED'], required: true },
    { kind: 'number', name: 'coolingCapacityTon', label: 'Cooling Capacity (Ton)', min: 0, step: 0.5 },
    { kind: 'select', name: 'gasType', label: 'Gas Type', options: ['R_22', 'R_32', 'R_410A'], required: true },
    { kind: 'number', name: 'distanceIndoorOutdoorFt', label: 'Indoor-Outdoor Distance (ft)', min: 0, required: true },
    { kind: 'date', name: 'purchaseDate', label: 'Purchase Date', required: true },
    ...COMMON_TAIL,
  ],
  fridge: [
    { kind: 'text', name: 'company', label: 'Company', required: true },
    { kind: 'select', name: 'coolingType', label: 'Cooling Type', options: ['DIRECT_COOLING', 'FROST_FREE'], required: true },
    { kind: 'number', name: 'capacityLtr', label: 'Capacity (Ltr)', min: 0, required: true },
    { kind: 'number', name: 'numberOfDoors', label: 'Number of Doors', min: 1, step: 1, required: true },
    { kind: 'select', name: 'freezerPosition', label: 'Freezer Position', options: ['TOP_FREEZER', 'BOTTOM_FREEZER', 'SIDE_BY_SIDE'], required: true },
    { kind: 'select', name: 'gasType', label: 'Gas Type', options: ['R_600', 'R_134A', 'R_290'], required: true },
    { kind: 'date', name: 'purchaseDate', label: 'Purchase Date', required: true },
    ...COMMON_TAIL,
  ],
  washing_machine: [
    { kind: 'text', name: 'company', label: 'Company', required: true },
    { kind: 'select', name: 'loadType', label: 'Load Type', options: ['FRONT_LOAD', 'TOP_LOAD'], required: true },
    { kind: 'select', name: 'automation', label: 'Automation', options: ['SEMI_AUTOMATIC', 'FULLY_AUTOMATIC'], required: true },
    { kind: 'number', name: 'storageCapacityKg', label: 'Capacity (Kg)', min: 0, required: true },
    { kind: 'select', name: 'dryingCapability', label: 'Drying Capability', options: ['NONE', 'HEAT_DRY'], required: true },
    { kind: 'date', name: 'purchaseDate', label: 'Purchase Date', required: true },
    ...COMMON_TAIL,
  ],
  geyser: [
    { kind: 'text', name: 'company', label: 'Company', required: true },
    { kind: 'select', name: 'heatingType', label: 'Heating Type', options: ['GAS', 'ELECTRIC'], required: true },
    { kind: 'number', name: 'capacityLtr', label: 'Capacity (Ltr)', min: 0, required: true },
    { kind: 'date', name: 'purchaseDate', label: 'Purchase Date', required: true },
    ...COMMON_TAIL,
  ],
  master_purifier: [
    { kind: 'text', name: 'company', label: 'Company', required: true },
    { kind: 'number', name: 'waterTankCapacity', label: 'Water Tank Capacity (Ltr)', min: 0, required: true },
    { kind: 'date', name: 'purchaseDate', label: 'Purchase Date', required: true },
    {
      kind: 'checkboxGroup',
      name: 'basicTechnology',
      label: 'Basic Technology',
      options: [
        { key: 'spunFilter', label: 'Spun Filter' },
        { key: 'sedimentFilter', label: 'Sediment Filter' },
        { key: 'preCarbonFilter', label: 'Pre-Carbon Filter' },
        { key: 'postCarbonFilter', label: 'Post-Carbon Filter' },
        { key: 'uv', label: 'UV' },
        { key: 'uf', label: 'UF' },
        { key: 'tdsController', label: 'TDS Controller' },
        { key: 'alkalineFilter', label: 'Alkaline Filter' },
      ],
    },
    {
      kind: 'checkboxGroup',
      name: 'additionalTechnology',
      label: 'Additional Technology',
      options: [
        { key: 'copper', label: 'Copper' },
        { key: 'magnesium', label: 'Magnesium' },
        { key: 'zinc', label: 'Zinc' },
        { key: 'selenium', label: 'Selenium' },
        { key: 'other', label: 'Other' },
      ],
    },
  ],
};
