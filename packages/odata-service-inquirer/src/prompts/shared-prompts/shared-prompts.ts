import { ConnectionValidator } from '../connectionValidator';
import { PromptState } from '../../utils';
import { Answers, ConfirmQuestion } from 'inquirer';
import { ConvertedMetadata } from '@sap-ux/vocabularies-types';
import { ServiceAnswer } from '../datasources/sap-system/service-selection';
import { AbapServiceProvider, createForAbap } from '@sap-ux/axios-extension';
import LoggerHelper from '../logger-helper';
import { t } from '../../i18n';
import { DatasourceType, OdataServiceAnswers } from '../../types';

export function getValueHelpDownloadPrompt(
    connectionValidator: ConnectionValidator,
    promptNamespace: string
): ConfirmQuestion {
    const valueHelpDownloadConfirmName = `${promptNamespace}:valueHelpDownloadConfirm`;
    let cachedServicePath: string | undefined;
    let valueListRefsAnnotations: { target: string; rootPath: string; value: string }[] | undefined;
    const question = {
        when: () => {
            if (!!PromptState.odataService.metadata && !!PromptState.odataService.servicePath) {
                // todo: Should not re-evaluate this every time this `when` condition executes
                valueListRefsAnnotations = AbapServiceProvider.getValueListReferences(
                            PromptState.odataService.servicePath,
                            PromptState.odataService.metadata,
                            PromptState.odataService.annotations ?? []
                        );
                return valueListRefsAnnotations?.length > 0;
            }
            return false;
        },
        type: 'confirm',
        name: valueHelpDownloadConfirmName,
        default: false,
        validate: async (fetchValueHelps: boolean, answers: OdataServiceAnswers): Promise<boolean> => {

            if (
                // todo: check if we need to check the system hostname also...when system host is changed it might reset the prompt state
                fetchValueHelps &&
                PromptState.odataService.servicePath !== cachedServicePath && // Dont reload unless the service has changed
                PromptState.odataService.metadata &&
                PromptState.odataService.servicePath
            ) {
                // Since odata service url prompts do not create abap service providers we need to create one
                let abapServiceProvider: AbapServiceProvider | undefined;
                if (answers.datasourceType === DatasourceType.odataServiceUrl) {
                    abapServiceProvider = createForAbap(connectionValidator.axiosConfig);
                } else if (connectionValidator.serviceProvider instanceof AbapServiceProvider) {
                    abapServiceProvider = connectionValidator.serviceProvider;
                }
                if (abapServiceProvider) {
                    cachedServicePath = PromptState.odataService.servicePath;
                    
                    if (Array.isArray(valueListRefsAnnotations) && valueListRefsAnnotations.length > 0) {
                        const valueListReferences = await abapServiceProvider
                            .fetchValueListReferenceServices(valueListRefsAnnotations)
                            .catch(() => {
                                LoggerHelper.logger.info(t('prompts.validationMessages.noValueListReferences'));
                            });
                        PromptState.odataService.valueListReferences = valueListReferences ?? undefined;
                    }
                }
            } else {
                cachedServicePath = undefined;
                PromptState.odataService.valueListReferences = undefined;
            }
            return true;
        }
    } as ConfirmQuestion;

    return question;
}
