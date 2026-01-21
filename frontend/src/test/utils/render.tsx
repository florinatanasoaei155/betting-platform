import { render, RenderOptions } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import { ReactElement, ReactNode } from 'react';

interface WrapperProps {
  children: ReactNode;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  mocks?: MockedResponse[];
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  { mocks = [], ...options }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: WrapperProps) {
    return (
      <MockedProvider mocks={mocks} addTypename={false}>
        <BrowserRouter>{children}</BrowserRouter>
      </MockedProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}

export * from '@testing-library/react';
export { renderWithProviders as render };
