import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Octokit } from '@octokit/rest';
import { AlertmanagerPayloadDto } from './dto/alertmanager-webhook.dto';
import { Incident, IncidentStatus } from '../incidents/entities/incident.entity';

@Injectable()
export class ActionEngineService {
  private readonly logger = new Logger(ActionEngineService.name);
  private octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
  ) {}

  async processAlert(payload: AlertmanagerPayloadDto) {
    const alert = payload.alerts?.[0];
    if (!alert) return { status: 'NO_ALERTS' };

    const alertName = alert.labels.alertname || 'UnknownAlert';
    const action = alert.labels.action || 'GITOPS_HOTFIX';

    const incident = await this.incidentRepo.save({
      alertName,
      rawMetrics: alert,
      status: IncidentStatus.IN_PROGRESS,
    });

    try {
      if (action === 'GITOPS_HOTFIX') {
        const prResult = await this.createHotfixPR(alertName);
        await this.incidentRepo.update(incident.id, {
          status: IncidentStatus.DRAFT_PR_OPENED,
          draftPrUrl: prResult.prUrl,
        });
        return prResult;
      }

      return { status: 'ACTION_NOT_SUPPORTED', action };
    } catch (err) {
      this.logger.error(`Remediation failed: ${err.message}`);
      await this.incidentRepo.update(incident.id, { status: IncidentStatus.FAILED });
      return { success: false, error: err.message };
    }
  }

  private async createHotfixPR(alertName: string) {
    const repoOwner = process.env.GITHUB_OWNER || 'owner';
    const repoName = process.env.GITHUB_REPO || 'repo';
    const branchName = `hotfix/alert-${Date.now()}`;

    const { data: mainRef } = await this.octokit.git.getRef({
      owner: repoOwner,
      repo: repoName,
      ref: 'heads/main',
    });

    await this.octokit.git.createRef({
      owner: repoOwner,
      repo: repoName,
      ref: `refs/heads/${branchName}`,
      sha: mainRef.object.sha,
    });

    const { data: pr } = await this.octokit.pulls.create({
      owner: repoOwner,
      repo: repoName,
      title: `hotfix(auto): remediate ${alertName}`,
      head: branchName,
      base: 'main',
      body: `Automated patch initiated by **Compass Action Engine** for alert: \`${alertName}\`.`,
      draft: true,
    });

    return { success: true, prUrl: pr.html_url, branch: branchName };
  }
}
