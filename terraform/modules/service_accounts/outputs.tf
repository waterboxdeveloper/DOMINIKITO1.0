# Outputs for the service_accounts module

output "cloud_run_sa_email" {
  value       = google_service_account.run_sa.email
  description = "The email of the Cloud Run runtime service account."
}

output "agent_sa_email" {
  value       = google_service_account.agent_sa.email
  description = "The email of the Agent Registry / Agent Runtime service account."
}

output "deploy_sa_email" {
  value       = google_service_account.deploy_sa.email
  description = "The email of the CI/CD deployment service account."
}
