export interface TemperatureQuality {
  raw_rows: number;
  usable_rows: number;
  missing_temperature_or_timestamp_rows: number;
  known_sensor_glitch_rows: number;
  duplicate_rows: number;
  conflicting_duplicate_timestamps: number;
  estimated_missing_hourly_readings: number;
  out_of_range_readings: number;
  above_range_readings: number;
  below_range_readings: number;
}

export interface IncidentTrend {
  month: string;
  warning_count: number;
  sustained_count: number;
}

export interface FacilityMonitoring {
  facility_id: string;
  incident_count: number;
  sustained_count: number;
  latest_incident_at: string | null;
}

export interface DashboardData {
  site_name: string;
  country: string;
  temperature_policy: TemperaturePolicy;
  dataset_note: string;
  temperature_quality: TemperatureQuality;
  feature_evaluation: FeatureEvaluation;
  incident_count: number;
  sustained_incident_count: number;
  warning_episode_count: number;
  potentially_affected_unit_matches: number;
  unique_potentially_affected_units: number;
  incidents_with_power_outage_overlap: number;
  location_intervals_built: number;
  safety_note: string;
  incident_trends: IncidentTrend[];
  facility_monitoring: FacilityMonitoring[];
}

export interface TemperaturePolicy {
  minimum_c: number;
  maximum_c: number;
}

export interface SiteConfig {
  site_name: string;
  country: string;
  temperature_policy: TemperaturePolicy;
  identity_mode: string;
}

export interface EvaluationMetrics {
  candidate_units: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
  precision: number;
  recall: number;
}

export interface FeatureEvaluation {
  available: boolean;
  feature_name?: string;
  baseline_name?: string;
  population_units?: number;
  labeled_exposed_units?: number;
  feature?: EvaluationMetrics;
  baseline?: EvaluationMetrics;
  note: string;
}

export interface Incident {
  incident_id: string;
  facility_id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  reading_count: number;
  peak_temp_c: number;
  minimum_temp_c: number;
  direction: string;
  severity: "warning" | "sustained" | string;
  sustained_rule: string;
}

export interface AffectedUnit {
  incident_id: string;
  unit_id: string;
  facility_id: string;
  exposure_start: string;
  exposure_end: string;
  component: string;
  blood_group: string;
  unit_status: string;
}

export interface TemperaturePoint {
  recorded_at: string;
  temp_c: number | null;
  quality_status: "valid" | "known_sensor_glitch" | string;
}

export interface PowerCorrelation {
  incident_id: string;
  outage_id: string;
  backup_power_engaged: string | boolean;
  overlap_minutes: number;
}

export interface TransportAlert {
  transfer_id: string;
  unit_id: string;
  component: string;
  blood_group: string;
  unit_status: string;
  from_facility_id: string;
  to_facility_id: string;
  transfer_type: string;
  dispatched_at: string | null;
  received_at: string | null;
  transport_mode: string;
  coolbox_max_temp_c: number;
}

export interface IncidentDetail {
  incident: Incident;
  potentially_affected_units: AffectedUnit[];
  temperature_history: TemperaturePoint[];
  power_correlations: PowerCorrelation[];
  decision_required: boolean;
  notice: string;
  temperature_policy: TemperaturePolicy;
}

export type ReviewRole = "facility_staff" | "blood_service_supervisor";
export type ReviewDecision = "accept" | "change" | "reject";

export interface ReviewEvent {
  review_id: string;
  incident_id: string;
  actor_name: string;
  role: ReviewRole;
  decision: ReviewDecision;
  reason: string;
  changed_assessment: string | null;
  created_at: string;
  auth_method?: "preprovisioned_demo_account" | "legacy_self_reported";
  sync_status?: "pending_sync";
}

export interface AuthenticatedUser {
  username: string;
  actor_name: string;
  role: ReviewRole;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  notice?: string;
}

export type DataQuality = TemperatureQuality;
