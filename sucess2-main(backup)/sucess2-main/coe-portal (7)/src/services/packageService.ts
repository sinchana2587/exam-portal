import { examinationService } from './examinationService';

export const packageService = {
  prepareAndSendSittingPackage: examinationService.prepareAndSendSittingPackage,
  retrySittingPackageTransfer: examinationService.retrySittingPackageTransfer,
};
