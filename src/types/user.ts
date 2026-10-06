/** The minimal, authentication-provider-independent user shape LaunchKit understands. */
export interface LaunchUser<
  Metadata extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  email?: string;
  roles?: readonly string[];
  plan?: string;
  tags?: readonly string[];
  metadata?: Metadata;
}
