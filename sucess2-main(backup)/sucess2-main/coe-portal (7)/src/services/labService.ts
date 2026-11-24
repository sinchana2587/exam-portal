import { examinationService } from './examinationService';

export const labService = {
  getLabServers: examinationService.getLabServers,
  prepareAndSendSittingPackage: examinationService.prepareAndSendSittingPackage,
  retrySittingPackageTransfer: examinationService.retrySittingPackageTransfer,
};
