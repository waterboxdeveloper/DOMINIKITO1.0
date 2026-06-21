# Variables for the service_accounts module

variable "project_id" {
  type        = string
  description = "The main GCP Project ID."
}

variable "firebase_project_id" {
  type        = string
  description = "The Firebase Project ID."
}

variable "app_name" {
  type        = string
  description = "Application name for resource naming."
}

variable "vertex_ai_sa_member" {
  type        = string
  description = "The service identity member for Vertex AI (e.g. serviceAccount:service-PROJECT_NUMBER@gcp-sa-aiplatform.iam.gserviceaccount.com)."
}

variable "staging_bucket_name" {
  type        = string
  description = "Name of the GCS bucket used for staging agent code."
}
