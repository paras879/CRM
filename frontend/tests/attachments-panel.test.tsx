import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiFetch = vi.fn();

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { apiFetch: (...args: unknown[]) => apiFetch(...args), ApiError };
});

import { AttachmentsPanel } from '@/components/ui/attachments-panel';
import { ApiError } from '@/lib/api';

const entityId = '11111111-1111-1111-1111-111111111111';
const file = (id: string, name: string, size = 2048) => ({
  id,
  fileName: name,
  mimeType: 'text/plain',
  sizeBytes: size,
  createdAt: '2026-01-05T00:00:00.000Z',
});

describe('AttachmentsPanel', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows an empty state when nothing is attached', async () => {
    apiFetch.mockResolvedValueOnce({ data: [] });
    render(<AttachmentsPanel entityType="customer" entityId={entityId} />);
    expect(await screen.findByText(/no files attached yet/i)).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(`/attachments?entityType=customer&entityId=${entityId}`);
  });

  it('lists files with a readable size and a download link', async () => {
    apiFetch.mockResolvedValueOnce({ data: [file('a1', 'contract.pdf', 2048)] });
    render(<AttachmentsPanel entityType="project" entityId={entityId} />);

    expect(await screen.findByText('contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download contract.pdf/i })).toHaveAttribute(
      'href',
      '/api/v1/attachments/a1/download'
    );
  });

  it('uploads the chosen file as a raw octet-stream body and refreshes the list', async () => {
    apiFetch.mockResolvedValueOnce({ data: [] });
    const { container } = render(<AttachmentsPanel entityType="invoice" entityId={entityId} />);
    await screen.findByText(/no files attached yet/i);

    apiFetch.mockResolvedValueOnce({ data: file('a2', 'notes.txt') }).mockResolvedValueOnce({ data: [file('a2', 'notes.txt')] });
    const upload = new File(['hello'], 'my notes.txt', { type: 'text/plain' });
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, upload);

    await waitFor(() => expect(screen.getByText('notes.txt')).toBeInTheDocument());
    const [url, init] = apiFetch.mock.calls[1];
    expect(url).toBe(`/attachments?entityType=invoice&entityId=${entityId}&fileName=my%20notes.txt`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/octet-stream');
    expect(init.body).toBe(upload);
  });

  it('shows the server error when an upload is rejected', async () => {
    apiFetch.mockResolvedValueOnce({ data: [] });
    const { container } = render(<AttachmentsPanel entityType="ticket" entityId={entityId} />);
    await screen.findByText(/no files attached yet/i);

    apiFetch.mockRejectedValueOnce(new ApiError(400, 'FILE_TYPE_NOT_ALLOWED', 'This file type is not allowed.'));
    await userEvent.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['x'], 'run.exe')
    );
    expect(await screen.findByText('This file type is not allowed.')).toBeInTheDocument();
  });

  it('deletes a file after confirmation', async () => {
    apiFetch.mockResolvedValueOnce({ data: [file('a3', 'old.txt')] });
    render(<AttachmentsPanel entityType="lead" entityId={entityId} />);
    await screen.findByText('old.txt');

    apiFetch.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole('button', { name: /delete old.txt/i }));

    await waitFor(() => expect(screen.queryByText('old.txt')).not.toBeInTheDocument());
    expect(apiFetch).toHaveBeenLastCalledWith('/attachments/a3', { method: 'DELETE' });
  });

  it('keeps the file when deletion is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    apiFetch.mockResolvedValueOnce({ data: [file('a4', 'keep.txt')] });
    render(<AttachmentsPanel entityType="lead" entityId={entityId} />);
    await screen.findByText('keep.txt');

    await userEvent.click(screen.getByRole('button', { name: /delete keep.txt/i }));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('keep.txt')).toBeInTheDocument();
  });
});
