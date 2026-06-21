# Root variables for Dominikito GCP setup

variable "project_id" {
  type        = string
  description = "The main GCP Project ID where resources (Cloud Run, Agent Registry) will be deployed."
}

variable "firebase_project_id" {
  type        = string
  description = "The Firebase Project ID associated with the frontend services (Auth, Firestore, Storage)."
}

variable "region" {
  type        = string
  description = "The GCP region for deploying resources (e.g. us-central1, us-east1)."
  default     = "us-central1"
}

variable "app_name" {
  type        = string
  description = "The name of the application, used as a prefix for naming resources."
  default     = "dominikito"
}
