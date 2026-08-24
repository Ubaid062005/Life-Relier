import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';
import { API_BASE_URL } from '../utils/constants';

export interface GenerateReportPdfParams {
  PatRegID: number;
  PID: number;
  MainTestIds?: number[];
  BranchId?: number;
  CompanyId?: number;
  TimeZoneId?: number;
  PrintMode?: 'WITHOUT_LETTERHEAD' | 'WITH_LETTERHEAD';
}

/**
 * Downloads and saves Patient Test Report PDF locally to fileUri
 */
export async function generateReportPdfFile(params: GenerateReportPdfParams): Promise<string> {
  const url = `${API_BASE_URL}/api/ReportTemplate/Generate`;
  const branchId = params.BranchId ?? 1;
  const companyId = params.CompanyId ?? 1;
  const timeZoneId = params.TimeZoneId ?? 1;
  const printMode = params.PrintMode ?? 'WITHOUT_LETTERHEAD';
  const mainTestIds = params.MainTestIds ?? [];

  const payload = {
    PatRegID: Number(params.PatRegID),
    PID: Number(params.PID),
    MainTestIds: mainTestIds,
    BranchId: branchId,
    CompanyId: companyId,
    TimeZoneId: timeZoneId,
    PrintMode: printMode,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/pdf, application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate PDF. Server returned status ${response.status}`);
  }

  const blob = await response.blob();
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const sanitizedDate = new Date().toISOString().replace(/[:.]/g, '-');
  const fileUri = `${baseDir}Report_PT${params.PatRegID}_PID${params.PID}_${sanitizedDate}.pdf`;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resultStr = reader.result as string;
        const base64data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        await FileSystem.writeAsStringAsync(fileUri, base64data, { encoding: 'base64' });
        resolve(fileUri);
      } catch (err: any) {
        reject(new Error(`Failed to write PDF: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read PDF blob as base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates report PDF and opens the system Share sheet (Image 1)
 */
export async function generateAndShareReportPdf(params: GenerateReportPdfParams): Promise<string> {
  const fileUri = await generateReportPdfFile(params);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Patient Report (PT: ${params.PatRegID} / PID: ${params.PID})`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('Report Generated', `PDF saved to: ${fileUri}`);
  }
  return fileUri;
}

/**
 * Generates report PDF and opens the "Open with" / PDF viewer app chooser (Image 2)
 */
export async function generateAndViewReportPdf(params: GenerateReportPdfParams): Promise<string> {
  const fileUri = await generateReportPdfFile(params);

  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/pdf',
      });
      return fileUri;
    } catch {
      // Fallback to sharing if IntentLauncher fails
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `View Report (PT: ${params.PatRegID})`,
          UTI: 'com.adobe.pdf',
        });
      }
    }
  } else {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `View Report (PT: ${params.PatRegID})`,
        UTI: 'com.adobe.pdf',
      });
    }
  }

  return fileUri;
}

/**
 * Generates report PDF and opens the native Print dialog
 */
export async function generateAndPrintReportPdf(params: GenerateReportPdfParams): Promise<string> {
  const fileUri = await generateReportPdfFile(params);
  await Print.printAsync({ uri: fileUri });
  return fileUri;
}
